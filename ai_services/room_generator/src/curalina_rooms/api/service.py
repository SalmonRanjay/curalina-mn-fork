"""Contract service for `curalina_rooms` `/v1` routes.

`RoomsContractService` validates requests against the shapes in
`curalina_rooms.api.schemas` and enforces the shared error vocabulary from
`curalina_rooms.api.errors`. It has two backends, selected by whether a
`SQLiteRoomStore` is supplied at construction time:

* **No store (the A1 fake):** an in-memory, fixture-seeded fake with no
  durable persistence and no worker split. This is what the contract-level
  tests (`tests/contract/`) exercise directly, since they test the contract
  shape, not durability.
* **A `SQLiteRoomStore` (the A3 durable path):** every method delegates to
  the store after validating and schema-version-checking the payload, so
  jobs survive process restarts and are completed by a separate worker
  (`curalina_rooms.workers`) via lease/complete rather than inline.

`create_app()` (`curalina_rooms.api.app`) wires the store-backed path by
default; tests that want the fast in-memory fake construct
`RoomsContractService()` explicitly.
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any, TypeVar
from uuid import uuid4

from pydantic import BaseModel, ValidationError

from curalina_rooms.api.errors import (
    malformed_request_error,
    missing_reference_image_error,
    resource_not_found_error,
    review_version_conflict_error,
    stale_bundle_revision_error,
    unknown_bundle_error,
    unsupported_schema_version_error,
)
from curalina_rooms.api.fixtures import load_fixture
from curalina_rooms.api.schemas import (
    AssetContentResponse,
    AssetImportRequest,
    AssetResponse,
    CandidateReviewRequest,
    CandidateReviewResponse,
    JobCancelResponse,
    JobStatusResponse,
    RenderJobRequest,
    RenderJobResponse,
)
from curalina_rooms.api.sqlite_store import SQLiteRoomStore

_SUPPORTED_SCHEMA_MAJOR = "1"
_DEFAULT_MAX_ATTEMPTS = 3

ModelT = TypeVar("ModelT", bound=BaseModel)


@dataclass(frozen=True)
class ContractResult:
    """What a real transport layer (A3) would turn into an HTTP response."""

    http_status: int
    body: BaseModel
    headers: dict[str, str] = field(default_factory=dict)


def _new_request_id() -> str:
    return f"req_{uuid4().hex[:16]}"


def _utc_now_iso() -> str:
    return datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


def _check_schema_version(payload: dict[str, Any], request_id: str) -> None:
    """Reject an unsupported major version before structural validation.

    A missing `schema_version` is left to the structural validator so it
    produces a 400 malformed-request error rather than being conflated with
    an explicit, well-formed but unsupported version.
    """

    version = payload.get("schema_version")
    if isinstance(version, str) and "." in version:
        major = version.split(".", 1)[0]
        if major != _SUPPORTED_SCHEMA_MAJOR:
            raise unsupported_schema_version_error(request_id, version)


def _validate(
    model_cls: type[ModelT], payload: dict[str, Any], request_id: str
) -> ModelT:
    try:
        return model_cls.model_validate(payload)
    except ValidationError as exc:
        errors: list[dict[str, Any]] = [dict(error) for error in exc.errors()]
        raise malformed_request_error(request_id, errors) from exc


class RoomsContractService:
    """Contract service behind the room-generator `/v1` API.

    Backed by an in-memory fixture-seeded fake when `store` is `None`, or by
    a durable `SQLiteRoomStore` otherwise. See the module docstring.
    """

    def __init__(
        self,
        store: SQLiteRoomStore | None = None,
        *,
        max_attempts: int = _DEFAULT_MAX_ATTEMPTS,
        failure_after_insertions: int | None = None,
    ) -> None:
        self._store = store
        self._max_attempts = max_attempts
        self._failure_after_insertions = failure_after_insertions
        if store is None:
            self._bundle_current_revision: dict[str, str] = {}
            self._assets: dict[str, AssetResponse] = {}
            self._jobs: dict[str, JobStatusResponse] = {}
            self._candidate_review_versions: dict[str, int] = {}
            self._seed_from_fixtures()

    def _seed_from_fixtures(self) -> None:
        bundles = load_fixture("bundle_snapshots.json")["bundles"]
        for bundle in bundles:
            self._bundle_current_revision[bundle["bundle_id"]] = bundle[
                "current_revision"
            ]

        assets = load_fixture("seed_assets.json")["assets"]
        for asset in assets:
            response = AssetResponse.model_validate(asset)
            self._assets[response.asset_id] = response

        candidates = load_fixture("seed_candidates.json")["candidates"]
        for candidate in candidates:
            self._candidate_review_versions[candidate["candidate_id"]] = candidate[
                "revision"
            ]

    # -- Assets ---------------------------------------------------------

    def import_asset(
        self, payload: dict[str, Any], request_id: str | None = None
    ) -> ContractResult:
        request_id = request_id or _new_request_id()
        _check_schema_version(payload, request_id)
        request: AssetImportRequest = _validate(
            AssetImportRequest, payload, request_id
        )

        if self._store is not None:
            response = self._store.import_asset(request, request_id=request_id)
            return ContractResult(http_status=201, body=response)

        digest_source = "|".join(
            [
                request.owner_id,
                request.original_filename,
                str(request.content_length),
                request.upstream_asset_id or "",
            ]
        ).encode("utf-8")
        content_hash = "sha256:" + hashlib.sha256(digest_source).hexdigest()
        asset_id = f"asset_{uuid4().hex[:16]}"

        response = AssetResponse(
            asset_id=asset_id,
            upstream_asset_id=request.upstream_asset_id,
            owner_id=request.owner_id,
            content_hash=content_hash,
            media_type=request.media_type,
            original_filename=request.original_filename,
            provenance=request.provenance,
            created_at=_utc_now_iso(),
        )
        self._assets[asset_id] = response
        return ContractResult(http_status=201, body=response)

    def get_asset_content(
        self, asset_id: str, request_id: str | None = None
    ) -> ContractResult:
        request_id = request_id or _new_request_id()
        if self._store is not None:
            store_response = self._store.get_asset_content(
                asset_id, request_id=request_id
            )
            return ContractResult(http_status=200, body=store_response)

        asset = self._assets.get(asset_id)
        if asset is None:
            raise resource_not_found_error(request_id, "asset", asset_id)

        response = AssetContentResponse(
            asset_id=asset.asset_id,
            content_hash=asset.content_hash,
            media_type=asset.media_type,
            byte_size=1,
            # Derived from the public asset id only. The storage-adapter key
            # is internal and is never serialized (ADR-0003).
            content_ref=f"content://assets/{asset.asset_id}",
        )
        return ContractResult(http_status=200, body=response)

    # -- Render jobs ------------------------------------------------------

    def create_render_job(
        self, payload: dict[str, Any], request_id: str | None = None
    ) -> ContractResult:
        request_id = request_id or _new_request_id()
        _check_schema_version(payload, request_id)
        request: RenderJobRequest = _validate(RenderJobRequest, payload, request_id)

        if self._store is not None:
            store_response = self._store.create_render_job(
                request,
                request_id=request_id,
                max_attempts=self._max_attempts,
                failure_after_insertions=self._failure_after_insertions,
            )
            return ContractResult(
                http_status=202,
                body=store_response,
                headers={"Location": store_response.location},
            )

        current_revision = self._bundle_current_revision.get(
            request.bundle.bundle_id
        )
        if current_revision is None:
            raise unknown_bundle_error(request_id, request.bundle.bundle_id)
        if current_revision != request.bundle.bundle_revision:
            raise stale_bundle_revision_error(
                request_id,
                request.bundle.bundle_id,
                request.bundle.bundle_revision,
                current_revision,
            )

        for reference in request.reference_images:
            if reference.asset_id not in self._assets:
                raise missing_reference_image_error(request_id, reference.asset_id)

        job_id = f"job_{uuid4().hex[:16]}"
        response = RenderJobResponse(
            job_id=job_id,
            location=f"/v1/jobs/{job_id}",
            bundle_id=request.bundle.bundle_id,
            bundle_revision=request.bundle.bundle_revision,
            created_at=_utc_now_iso(),
        )
        self._jobs[job_id] = JobStatusResponse(
            job_id=job_id, status="queued", attempt_count=0
        )
        return ContractResult(
            http_status=202,
            body=response,
            headers={"Location": response.location},
        )

    def get_job(self, job_id: str, request_id: str | None = None) -> ContractResult:
        request_id = request_id or _new_request_id()
        if self._store is not None:
            store_job = self._store.get_job(job_id, request_id=request_id)
            return ContractResult(http_status=200, body=store_job)

        job = self._jobs.get(job_id)
        if job is None:
            raise resource_not_found_error(request_id, "job", job_id)
        return ContractResult(http_status=200, body=job)

    def cancel_job(self, job_id: str, request_id: str | None = None) -> ContractResult:
        request_id = request_id or _new_request_id()
        if self._store is not None:
            self._store.cancel_job(job_id, request_id=request_id)
            return ContractResult(
                http_status=200, body=JobCancelResponse(job_id=job_id)
            )

        job = self._jobs.get(job_id)
        if job is None:
            raise resource_not_found_error(request_id, "job", job_id)

        cancelled = JobCancelResponse(job_id=job_id)
        self._jobs[job_id] = JobStatusResponse(
            job_id=job_id, status="cancelled", attempt_count=job.attempt_count
        )
        return ContractResult(http_status=200, body=cancelled)

    # -- Candidate reviews -------------------------------------------------

    def create_candidate_review(
        self,
        candidate_id: str,
        payload: dict[str, Any],
        request_id: str | None = None,
    ) -> ContractResult:
        request_id = request_id or _new_request_id()
        _check_schema_version(payload, request_id)
        request: CandidateReviewRequest = _validate(
            CandidateReviewRequest, payload, request_id
        )

        if self._store is not None:
            store_response = self._store.create_review(
                candidate_id, request, request_id=request_id
            )
            return ContractResult(http_status=201, body=store_response)

        current_version = self._candidate_review_versions.get(candidate_id)
        if current_version is None:
            raise resource_not_found_error(request_id, "candidate", candidate_id)
        if request.expected_revision != current_version:
            raise review_version_conflict_error(
                request_id, candidate_id, request.expected_revision,
                current_version,
            )

        next_version = current_version + 1
        self._candidate_review_versions[candidate_id] = next_version
        response = CandidateReviewResponse(
            review_id=f"review_{uuid4().hex[:12]}",
            candidate_id=candidate_id,
            reviewer_id=request.reviewer_id,
            decision=request.decision,
            revision=next_version,
            created_at=_utc_now_iso(),
        )
        return ContractResult(http_status=201, body=response)
