"""In-memory fixture-backed fake store for the A1 contract layer.

This is deliberately not a persistence layer: no SQLite, no file I/O, no
`ports`/`adapters` involvement. It exists only so the `/v1` HTTP contract
(request/response shapes, status codes, the job state machine and
idempotency behaviour) can be exercised end to end before A2/A3 build the
real durable job store and worker. Nothing here survives process restart and
nothing here is a stand-in for the durable job/lease/fencing design in
`03_data_contracts.md`'s "Durable job behaviour" section — that is A3 scope.
"""

from __future__ import annotations

import base64
import hashlib
import itertools
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Literal

from curalina_variants.api.errors import (
    idempotency_conflict_error,
    invalid_state_transition_error,
    not_found_error,
    payload_too_large_error,
    revision_conflict_error,
)
from curalina_variants.api.schemas import (
    ALLOWED_JOB_TRANSITIONS,
    AssetContent,
    AssetRecord,
    CandidateRecord,
    CreateAssetRequest,
    CreateMaskRequest,
    CreateReviewRequest,
    CreateVariantJobRequest,
    ErrorSummary,
    JobRecord,
    JobStatus,
    MaskRecord,
    ReviewRecord,
    ReviewStatus,
    VisualVariant,
)

MAX_ASSET_BYTES = 16 * 1024 * 1024  # 16 MiB; contract-level cap for A1 fixtures.


def _content_hash(content: bytes) -> str:
    return "sha256:" + hashlib.sha256(content).hexdigest()


def _canonical_request_hash(request: CreateVariantJobRequest) -> str:
    canonical = "|".join(
        [
            request.parent_product_id,
            request.source_asset_id,
            request.mask_id,
            request.target_colour,
            request.owner_id,
        ]
    )
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


@dataclass
class _IdempotencyEntry:
    request_hash: str
    job_id: str


@dataclass
class FakeJobStore:
    """Deterministic, in-process fake for asset/job/candidate/review state.

    Deterministic ID counters (rather than random UUIDs) keep contract test
    fixtures reproducible.
    """

    _asset_ids: itertools.count[int] = field(default_factory=lambda: itertools.count(1))
    _job_ids: itertools.count[int] = field(default_factory=lambda: itertools.count(1))
    _candidate_ids: itertools.count[int] = field(
        default_factory=lambda: itertools.count(1)
    )
    _review_ids: itertools.count[int] = field(
        default_factory=lambda: itertools.count(1)
    )

    assets: dict[str, AssetRecord] = field(default_factory=dict)
    _asset_bytes: dict[str, bytes] = field(default_factory=dict)
    masks: dict[str, MaskRecord] = field(default_factory=dict)
    jobs: dict[str, JobRecord] = field(default_factory=dict)
    _job_requests: dict[str, CreateVariantJobRequest] = field(default_factory=dict)
    candidates: dict[str, CandidateRecord] = field(default_factory=dict)
    reviews: dict[str, list[ReviewRecord]] = field(default_factory=dict)
    _idempotency_index: dict[tuple[str, str, str], _IdempotencyEntry] = field(
        default_factory=dict
    )

    def create_asset(
        self, request: CreateAssetRequest, *, request_id: str
    ) -> AssetRecord:
        if len(request.content_bytes) > MAX_ASSET_BYTES:
            raise payload_too_large_error(
                request_id,
                max_bytes=MAX_ASSET_BYTES,
                received_bytes=len(request.content_bytes),
            )

        asset_id = f"asset_{next(self._asset_ids):06d}"
        content_hash = _content_hash(request.content_bytes)
        # A1 fixtures only: dimensions are not decoded from real image bytes
        # yet (that is A2's asset-import step). A fixed placeholder size
        # keeps the contract shape stable without pretending to run a real
        # decoder here.
        record = AssetRecord(
            asset_id=asset_id,
            content_hash=content_hash,
            media_type=request.media_type,
            width_px=1,
            height_px=1,
            owner_id=request.owner_id,
            provenance="upload",
            original_filename=request.original_filename,
            created_at=datetime.now(UTC),
        )
        self.assets[asset_id] = record
        self._asset_bytes[asset_id] = request.content_bytes
        return record

    def get_asset(self, asset_id: str, *, request_id: str) -> AssetRecord:
        record = self.assets.get(asset_id)
        if record is None:
            raise not_found_error(request_id, resource="asset", resource_id=asset_id)
        return record

    def get_asset_content(self, asset_id: str, *, request_id: str) -> AssetContent:
        record = self.get_asset(asset_id, request_id=request_id)
        return AssetContent(
            media_type=record.media_type,
            content_bytes=self._asset_bytes[asset_id],
        )

    def create_mask(
        self, request: CreateMaskRequest, *, request_id: str
    ) -> MaskRecord:
        """Ingest a human-authored mask record.

        Validates that the editable_mask_b64 decodes and length matches
        width_px * height_px, and that all bytes are 0 or 1. Persists the
        mask under its mask_id for later resolution in variant job creation."""

        decoded = base64.b64decode(request.editable_mask_b64)
        expected_len = request.width_px * request.height_px
        if len(decoded) != expected_len:
            raise ValueError(
                f"editable_mask_b64 decoded to {len(decoded)} bytes, but "
                f"{request.width_px}x{request.height_px}={expected_len} "
                "were expected"
            )

        record = MaskRecord(
            mask_id=request.mask_id,
            source_asset_id=request.source_asset_id,
            width_px=request.width_px,
            height_px=request.height_px,
            editable_mask_b64=request.editable_mask_b64,
            protected_subregions=request.protected_subregions,
            feather_band_px=request.feather_band_px,
            human_corrected=request.human_corrected,
            revision=request.revision,
            created_at=datetime.now(UTC),
        )
        self.masks[request.mask_id] = record
        return record

    def get_mask(self, mask_id: str, *, request_id: str) -> MaskRecord:
        """Retrieve a stored mask by ID."""
        mask = self.masks.get(mask_id)
        if mask is None:
            raise not_found_error(request_id, resource="mask", resource_id=mask_id)
        return mask

    def create_variant_job(
        self,
        request: CreateVariantJobRequest,
        *,
        idempotency_key: str,
        request_id: str,
    ) -> tuple[JobRecord, bool]:
        """Returns (job, created). `created` is False when an identical
        request replayed an existing idempotency key.

        Validates that the mask_id references an ingested mask; if not found,
        raises a 404 not_found error per the contract."""

        # Validate that the mask exists before creating the job
        mask = self.masks.get(request.mask_id)
        if mask is None:
            raise not_found_error(
                request_id, resource="mask", resource_id=request.mask_id
            )

        request_hash = _canonical_request_hash(request)
        index_key = (request.owner_id, "create_variant_job", idempotency_key)
        existing = self._idempotency_index.get(index_key)
        if existing is not None:
            if existing.request_hash != request_hash:
                raise idempotency_conflict_error(
                    request_id, idempotency_key=idempotency_key
                )
            return self.jobs[existing.job_id], False

        job_id = f"job_{next(self._job_ids):06d}"
        now = datetime.now(UTC)
        job = JobRecord(
            job_id=job_id,
            status=JobStatus.QUEUED,
            owner_id=request.owner_id,
            idempotency_key=idempotency_key,
            request_hash=request_hash,
            attempt_count=0,
            created_at=now,
            updated_at=now,
        )
        self.jobs[job_id] = job
        self._idempotency_index[index_key] = _IdempotencyEntry(
            request_hash=request_hash, job_id=job_id
        )
        self._job_requests[job_id] = request

        # The job is left `queued`: A1 has no worker (that is A3 scope), so
        # nothing runs behind it yet. `run_fake_job` below is the seam a
        # test (standing in for a future worker) uses to advance it.
        return job, True

    def run_fake_job(
        self, job_id: str, *, outcome: Literal["succeeded", "failed"] = "succeeded"
    ) -> JobRecord:
        """Advance a queued job through `running` to a terminal state,
        producing a fixture candidate on success. This stands in for the
        worker that A3 introduces; nothing here touches real image bytes or
        model weights. Not reachable from any HTTP endpoint — A1 has no
        durable worker to expose one."""

        job = self.jobs[job_id]
        running = self._transition(job, JobStatus.RUNNING)

        if outcome == "failed":
            failed = self._transition(running, JobStatus.FAILED)
            self.jobs[job_id] = failed.model_copy(
                update={
                    "attempt_count": failed.attempt_count + 1,
                    "failure": ErrorSummary(
                        code="fake_adapter_failure",
                        message="Fake ImageEditor adapter reported failure",
                    ),
                }
            )
            return self.jobs[job_id]

        request = self._job_requests[job_id]
        candidate_id = f"cand_{next(self._candidate_ids):06d}"
        variant = VisualVariant(
            variant_id=f"variant_{candidate_id[5:]}",
            parent_product_id=request.parent_product_id,
            source_asset_id=request.source_asset_id,
            output_asset_id=None,
            target_colour=request.target_colour,
            mask_id=request.mask_id,
            review_status=ReviewStatus.PENDING,
        )
        self.candidates[candidate_id] = CandidateRecord(
            candidate_id=candidate_id, variant=variant, revision=1
        )
        succeeded = self._transition(running, JobStatus.SUCCEEDED)
        self.jobs[job_id] = succeeded.model_copy(
            update={"candidate_id": candidate_id, "attempt_count": 1}
        )
        return self.jobs[job_id]

    def get_job(self, job_id: str, *, request_id: str) -> JobRecord:
        job = self.jobs.get(job_id)
        if job is None:
            raise not_found_error(request_id, resource="job", resource_id=job_id)
        return job

    def cancel_job(self, job_id: str, *, request_id: str) -> JobRecord:
        job = self.get_job(job_id, request_id=request_id)
        if JobStatus.CANCELLED not in ALLOWED_JOB_TRANSITIONS[job.status]:
            raise invalid_state_transition_error(
                request_id, current_status=job.status.value, action="cancel"
            )
        cancelled = self._transition(job, JobStatus.CANCELLED)
        self.jobs[job_id] = cancelled
        return cancelled

    def _transition(self, job: JobRecord, target: JobStatus) -> JobRecord:
        allowed = ALLOWED_JOB_TRANSITIONS[job.status]
        if target not in allowed:
            raise invalid_state_transition_error(
                "internal",
                current_status=job.status.value,
                action=f"transition to {target.value}",
            )
        updated = job.model_copy(
            update={"status": target, "updated_at": datetime.now(UTC)}
        )
        self.jobs[job.job_id] = updated
        return updated

    def create_review(
        self,
        candidate_id: str,
        request: CreateReviewRequest,
        *,
        request_id: str,
    ) -> ReviewRecord:
        candidate = self.candidates.get(candidate_id)
        if candidate is None:
            raise not_found_error(
                request_id, resource="candidate", resource_id=candidate_id
            )
        if request.expected_revision != candidate.revision:
            raise revision_conflict_error(
                request_id,
                expected_revision=request.expected_revision,
                actual_revision=candidate.revision,
            )

        next_revision = candidate.revision + 1
        review_status = (
            ReviewStatus.APPROVED
            if request.decision == "approved"
            else ReviewStatus.REJECTED
        )
        updated_variant = candidate.variant.model_copy(
            update={"review_status": review_status}
        )
        self.candidates[candidate_id] = candidate.model_copy(
            update={"variant": updated_variant, "revision": next_revision}
        )

        review = ReviewRecord(
            review_id=f"review_{next(self._review_ids):06d}",
            candidate_id=candidate_id,
            reviewer_id=request.reviewer_id,
            decision=request.decision,
            revision=next_revision,
            created_at=datetime.now(UTC),
        )
        self.reviews.setdefault(candidate_id, []).append(review)
        return review
