"""SQLite-backed durable store for variant A3 API and worker state."""

from __future__ import annotations

import hashlib
import sqlite3
from collections.abc import Iterator
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path

from curalina_variants.api.errors import (
    idempotency_conflict_error,
    invalid_state_transition_error,
    not_found_error,
    payload_too_large_error,
    revision_conflict_error,
)
from curalina_variants.api.schemas import (
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
from curalina_variants.api.store import MAX_ASSET_BYTES


class LeaseConflictError(RuntimeError):
    """Raised when a worker tries to complete a job leased by another worker."""


def sqlite_path_from_url(database_url: str) -> Path:
    prefix = "sqlite:///"
    if not database_url.startswith(prefix):
        raise ValueError(
            "variant A3 only supports sqlite:/// database URLs, got "
            f"{database_url!r}"
        )
    return Path(database_url.removeprefix(prefix))


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


def _model_json(model: object) -> str:
    assert hasattr(model, "model_dump_json")
    return str(model.model_dump_json())


def _utc_now() -> datetime:
    return datetime.now(UTC)


def _parse_datetime(value: str | None) -> datetime | None:
    if value is None:
        return None
    parsed = datetime.fromisoformat(value)
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=UTC)
    return parsed


@dataclass(frozen=True, slots=True)
class SQLiteJobStore:
    db_path: Path

    @classmethod
    def from_database_url(cls, database_url: str) -> SQLiteJobStore:
        return cls(db_path=sqlite_path_from_url(database_url))

    def initialize(self) -> None:
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        with self._connect() as connection:
            connection.executescript(
                """
                CREATE TABLE IF NOT EXISTS assets (
                    asset_id TEXT PRIMARY KEY,
                    record_json TEXT NOT NULL,
                    content_bytes BLOB NOT NULL
                );
                CREATE TABLE IF NOT EXISTS jobs (
                    job_id TEXT PRIMARY KEY,
                    record_json TEXT NOT NULL,
                    request_json TEXT NOT NULL,
                    lease_owner TEXT,
                    leased_until TEXT
                );
                CREATE TABLE IF NOT EXISTS idempotency_keys (
                    owner_id TEXT NOT NULL,
                    operation TEXT NOT NULL,
                    idempotency_key TEXT NOT NULL,
                    request_hash TEXT NOT NULL,
                    job_id TEXT NOT NULL,
                    PRIMARY KEY (owner_id, operation, idempotency_key)
                );
                CREATE TABLE IF NOT EXISTS candidates (
                    candidate_id TEXT PRIMARY KEY,
                    record_json TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS reviews (
                    review_id TEXT PRIMARY KEY,
                    candidate_id TEXT NOT NULL,
                    record_json TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS masks (
                    mask_id TEXT PRIMARY KEY,
                    record_json TEXT NOT NULL
                );
                """
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
        asset_id = self._next_id("assets", "asset_id", "asset")
        record = AssetRecord(
            asset_id=asset_id,
            content_hash=_content_hash(request.content_bytes),
            media_type=request.media_type,
            width_px=1,
            height_px=1,
            owner_id=request.owner_id,
            provenance="upload",
            original_filename=request.original_filename,
            created_at=_utc_now(),
        )
        with self._connect() as connection:
            connection.execute(
                """
                INSERT INTO assets (asset_id, record_json, content_bytes)
                VALUES (?, ?, ?)
                """,
                (asset_id, _model_json(record), request.content_bytes),
            )
        return record

    def get_asset(self, asset_id: str, *, request_id: str) -> AssetRecord:
        with self._connect() as connection:
            row = connection.execute(
                "SELECT record_json FROM assets WHERE asset_id = ?", (asset_id,)
            ).fetchone()
        if row is None:
            raise not_found_error(request_id, resource="asset", resource_id=asset_id)
        return AssetRecord.model_validate_json(str(row["record_json"]))

    def get_asset_content(self, asset_id: str, *, request_id: str) -> AssetContent:
        with self._connect() as connection:
            row = connection.execute(
                "SELECT record_json, content_bytes FROM assets WHERE asset_id = ?",
                (asset_id,),
            ).fetchone()
        if row is None:
            raise not_found_error(request_id, resource="asset", resource_id=asset_id)
        record = AssetRecord.model_validate_json(str(row["record_json"]))
        return AssetContent(
            media_type=record.media_type,
            content_bytes=bytes(row["content_bytes"]),
        )

    def create_mask(
        self, request: CreateMaskRequest, *, request_id: str
    ) -> MaskRecord:
        """Ingest and persist a human-authored mask record.

        Validates that the mask_id is unique and all fields are valid before
        storing. Per `agentic_flow/15_variant_generation_technical_design.md`,
        masks are human-authored per-region artifacts."""

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
            created_at=_utc_now(),
        )
        with self._connect() as connection:
            connection.execute(
                """
                INSERT INTO masks (mask_id, record_json)
                VALUES (?, ?)
                """,
                (request.mask_id, _model_json(record)),
            )
        return record

    def get_mask(self, mask_id: str, *, request_id: str) -> MaskRecord:
        """Retrieve a stored mask by ID."""
        with self._connect() as connection:
            row = connection.execute(
                "SELECT record_json FROM masks WHERE mask_id = ?", (mask_id,)
            ).fetchone()
        if row is None:
            raise not_found_error(request_id, resource="mask", resource_id=mask_id)
        return MaskRecord.model_validate_json(str(row["record_json"]))

    def create_variant_job(
        self,
        request: CreateVariantJobRequest,
        *,
        idempotency_key: str,
        request_id: str,
    ) -> tuple[JobRecord, bool]:
        """Create a variant job, validating that the mask_id exists.

        Returns (job, created). `created` is False when an identical request
        replayed an existing idempotency key."""

        # Validate that the mask exists before creating the job
        # This is done before acquiring the connection to fail fast
        with self._connect() as connection:
            mask_row = connection.execute(
                "SELECT 1 FROM masks WHERE mask_id = ?", (request.mask_id,)
            ).fetchone()
        if mask_row is None:
            raise not_found_error(
                request_id, resource="mask", resource_id=request.mask_id
            )

        request_hash = _canonical_request_hash(request)
        index_key = (request.owner_id, "create_variant_job", idempotency_key)
        with self._connect() as connection:
            existing = connection.execute(
                """
                SELECT request_hash, job_id FROM idempotency_keys
                WHERE owner_id = ? AND operation = ? AND idempotency_key = ?
                """,
                index_key,
            ).fetchone()
            if existing is not None:
                if existing["request_hash"] != request_hash:
                    raise idempotency_conflict_error(
                        request_id, idempotency_key=idempotency_key
                    )
                return (
                    self.get_job(str(existing["job_id"]), request_id=request_id),
                    False,
                )

            job_id = self._next_id_with_connection(connection, "jobs", "job_id", "job")
            now = _utc_now()
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
            connection.execute(
                """
                INSERT INTO jobs
                    (job_id, record_json, request_json, lease_owner, leased_until)
                VALUES (?, ?, ?, NULL, NULL)
                """,
                (job_id, _model_json(job), request.model_dump_json()),
            )
            connection.execute(
                """
                INSERT INTO idempotency_keys
                    (owner_id, operation, idempotency_key, request_hash, job_id)
                VALUES (?, ?, ?, ?, ?)
                """,
                (*index_key, request_hash, job_id),
            )
        return job, True

    def get_job(self, job_id: str, *, request_id: str) -> JobRecord:
        with self._connect() as connection:
            row = connection.execute(
                "SELECT record_json FROM jobs WHERE job_id = ?", (job_id,)
            ).fetchone()
        if row is None:
            raise not_found_error(request_id, resource="job", resource_id=job_id)
        return JobRecord.model_validate_json(str(row["record_json"]))

    def get_candidate(self, candidate_id: str, *, request_id: str) -> CandidateRecord:
        with self._connect() as connection:
            row = connection.execute(
                "SELECT record_json FROM candidates WHERE candidate_id = ?",
                (candidate_id,),
            ).fetchone()
        if row is None:
            raise not_found_error(
                request_id, resource="candidate", resource_id=candidate_id
            )
        return CandidateRecord.model_validate_json(str(row["record_json"]))

    def cancel_job(self, job_id: str, *, request_id: str) -> JobRecord:
        job = self.get_job(job_id, request_id=request_id)
        if JobStatus.CANCELLED not in {target for target in _allowed_targets(job)}:
            raise invalid_state_transition_error(
                request_id, current_status=job.status.value, action="cancel"
            )
        cancelled = job.model_copy(
            update={"status": JobStatus.CANCELLED, "updated_at": _utc_now()}
        )
        self._save_job(cancelled, clear_lease=True)
        return cancelled

    def get_job_request(
        self, job_id: str, *, request_id: str
    ) -> CreateVariantJobRequest:
        """Retrieve the stored job request for a leased job.

        Used by the worker to access job parameters (mask_id, source_asset_id,
        target_colour) for transformation.
        """
        with self._connect() as connection:
            row = connection.execute(
                "SELECT request_json FROM jobs WHERE job_id = ?", (job_id,)
            ).fetchone()
        if row is None:
            raise not_found_error(request_id, resource="job", resource_id=job_id)
        return CreateVariantJobRequest.model_validate_json(str(row["request_json"]))

    def lease_next_job(
        self, *, worker_id: str, lease_seconds: int, request_id: str = "worker"
    ) -> JobRecord | None:
        now = _utc_now()
        lease_deadline = now + timedelta(seconds=lease_seconds)
        with self._connect() as connection:
            rows = connection.execute(
                "SELECT job_id, record_json, leased_until FROM jobs ORDER BY job_id"
            ).fetchall()
            for row in rows:
                job = JobRecord.model_validate_json(str(row["record_json"]))
                leased_until = _parse_datetime(row["leased_until"])
                lease_expired = leased_until is None or leased_until <= now
                if job.status not in {JobStatus.QUEUED, JobStatus.RUNNING}:
                    continue
                if job.status is JobStatus.RUNNING and not lease_expired:
                    continue
                if job.status is JobStatus.QUEUED:
                    job = job.model_copy(
                        update={"status": JobStatus.RUNNING, "updated_at": now}
                    )
                connection.execute(
                    """
                    UPDATE jobs
                    SET record_json = ?, lease_owner = ?, leased_until = ?
                    WHERE job_id = ?
                    """,
                    (
                        _model_json(job),
                        worker_id,
                        lease_deadline.isoformat(),
                        job.job_id,
                    ),
                )
                return job
        return None

    def complete_leased_job(
        self,
        job_id: str,
        *,
        worker_id: str,
        outcome: str = "succeeded",
        request_id: str = "worker",
        output_asset_bytes: bytes | None = None,
        failure_summary: ErrorSummary | None = None,
    ) -> JobRecord:
        with self._connect() as connection:
            row = connection.execute(
                """
                SELECT record_json, request_json, lease_owner FROM jobs
                WHERE job_id = ?
                """,
                (job_id,),
            ).fetchone()
        if row is None:
            raise not_found_error(request_id, resource="job", resource_id=job_id)
        if row["lease_owner"] != worker_id:
            raise LeaseConflictError(job_id)
        job = JobRecord.model_validate_json(str(row["record_json"]))
        request = CreateVariantJobRequest.model_validate_json(str(row["request_json"]))
        attempt_count = job.attempt_count + 1
        if outcome == "failed":
            # Use provided failure_summary or fall back to default fake adapter failure
            failure = failure_summary or ErrorSummary(
                code="fake_adapter_failure",
                message="Fake ImageEditor adapter reported failure",
            )
            failed = job.model_copy(
                update={
                    "status": JobStatus.FAILED,
                    "attempt_count": attempt_count,
                    "updated_at": _utc_now(),
                    "failure": failure,
                }
            )
            self._save_job(failed, clear_lease=True)
            return failed

        # Allocate IDs outside the transaction so monkeypatching/injection can
        # still occur during the allocation phase (testing seam).
        asset_id = self._next_id("assets", "asset_id", "asset")
        candidate_id = self._next_id("candidates", "candidate_id", "cand")

        with self._connect() as connection:
            # Re-check job status inside the transaction to prevent cancellation
            # from being overwritten by a completion that began before the
            # cancellation.
            job_row = connection.execute(
                "SELECT record_json, lease_owner FROM jobs WHERE job_id = ?",
                (job_id,),
            ).fetchone()
            if job_row is None:
                raise not_found_error(request_id, resource="job", resource_id=job_id)
            current_job = JobRecord.model_validate_json(str(job_row["record_json"]))
            current_lease_owner = job_row["lease_owner"]

            # Verify the job is still owned by this worker and is still running.
            if current_lease_owner != worker_id:
                raise LeaseConflictError(job_id)
            if current_job.status != JobStatus.RUNNING:
                raise LeaseConflictError(job_id)

            # Generate output asset — use provided bytes if available,
            # otherwise create fake.
            output_bytes = (
                output_asset_bytes
                if output_asset_bytes is not None
                else f"SYNTHETIC_VARIANT_{asset_id}".encode()
            )
            asset_record = AssetRecord(
                asset_id=asset_id,
                content_hash=_content_hash(output_bytes),
                media_type="image/png",
                width_px=512,
                height_px=512,
                owner_id=request.owner_id,
                provenance=(
                    "generated" if output_asset_bytes is not None else "fake_generated"
                ),
                original_filename=f"{asset_id}.png",
                created_at=_utc_now(),
            )
            connection.execute(
                """
                INSERT INTO assets (asset_id, record_json, content_bytes)
                VALUES (?, ?, ?)
                """,
                (asset_id, _model_json(asset_record), output_bytes),
            )

            # Create the candidate record with the pre-allocated ID.
            variant = VisualVariant(
                variant_id=f"variant_{candidate_id[5:]}",
                parent_product_id=request.parent_product_id,
                source_asset_id=request.source_asset_id,
                output_asset_id=asset_id,
                target_colour=request.target_colour,
                mask_id=request.mask_id,
                review_status=ReviewStatus.PENDING,
            )
            candidate = CandidateRecord(
                candidate_id=candidate_id, variant=variant, revision=1
            )
            connection.execute(
                """
                INSERT INTO candidates (candidate_id, record_json)
                VALUES (?, ?)
                """,
                (candidate_id, _model_json(candidate)),
            )

            succeeded = job.model_copy(
                update={
                    "status": JobStatus.SUCCEEDED,
                    "attempt_count": attempt_count,
                    "candidate_id": candidate_id,
                    "updated_at": _utc_now(),
                }
            )
            self._save_job_with_connection(connection, succeeded, clear_lease=True)
        return succeeded

    def run_fake_job(self, job_id: str, *, outcome: str = "succeeded") -> JobRecord:
        leased = self.lease_next_job(worker_id="inline_fake_worker", lease_seconds=30)
        if leased is None or leased.job_id != job_id:
            raise not_found_error("internal", resource="job", resource_id=job_id)
        return self.complete_leased_job(
            job_id, worker_id="inline_fake_worker", outcome=outcome
        )

    def create_review(
        self,
        candidate_id: str,
        request: CreateReviewRequest,
        *,
        request_id: str,
    ) -> ReviewRecord:
        with self._connect() as connection:
            row = connection.execute(
                "SELECT record_json FROM candidates WHERE candidate_id = ?",
                (candidate_id,),
            ).fetchone()
            if row is None:
                raise not_found_error(
                    request_id, resource="candidate", resource_id=candidate_id
                )
            candidate = CandidateRecord.model_validate_json(str(row["record_json"]))
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
            updated_candidate = candidate.model_copy(
                update={
                    "variant": candidate.variant.model_copy(
                        update={"review_status": review_status}
                    ),
                    "revision": next_revision,
                }
            )
            review_id = self._next_id_with_connection(
                connection, "reviews", "review_id", "review"
            )
            review = ReviewRecord(
                review_id=review_id,
                candidate_id=candidate_id,
                reviewer_id=request.reviewer_id,
                decision=request.decision,
                revision=next_revision,
                created_at=_utc_now(),
            )
            connection.execute(
                "UPDATE candidates SET record_json = ? WHERE candidate_id = ?",
                (_model_json(updated_candidate), candidate_id),
            )
            connection.execute(
                """
                INSERT INTO reviews (review_id, candidate_id, record_json)
                VALUES (?, ?, ?)
                """,
                (review_id, candidate_id, _model_json(review)),
            )
        return review

    def _save_job(self, job: JobRecord, *, clear_lease: bool) -> None:
        with self._connect() as connection:
            self._save_job_with_connection(connection, job, clear_lease=clear_lease)

    def _save_job_with_connection(
        self, connection: sqlite3.Connection, job: JobRecord, *, clear_lease: bool
    ) -> None:
        lease_owner = None if clear_lease else "__preserve__"
        leased_until = None if clear_lease else "__preserve__"
        if clear_lease:
            connection.execute(
                """
                UPDATE jobs
                SET record_json = ?, lease_owner = ?, leased_until = ?
                WHERE job_id = ?
                """,
                (_model_json(job), lease_owner, leased_until, job.job_id),
            )
        else:
            connection.execute(
                "UPDATE jobs SET record_json = ? WHERE job_id = ?",
                (_model_json(job), job.job_id),
            )

    def _next_id(self, table: str, column: str, prefix: str) -> str:
        with self._connect() as connection:
            return self._next_id_with_connection(connection, table, column, prefix)

    def _next_id_with_connection(
        self, connection: sqlite3.Connection, table: str, column: str, prefix: str
    ) -> str:
        rows = connection.execute(f"SELECT {column} FROM {table}").fetchall()
        max_seen = 0
        marker = f"{prefix}_"
        for row in rows:
            value = str(row[column])
            if value.startswith(marker):
                suffix = value.removeprefix(marker)
                if suffix.isdigit():
                    max_seen = max(max_seen, int(suffix))
        return f"{prefix}_{max_seen + 1:06d}"

    @contextmanager
    def _connect(self) -> Iterator[sqlite3.Connection]:
        connection = sqlite3.connect(self.db_path)
        connection.row_factory = sqlite3.Row
        try:
            with connection:
                yield connection
        finally:
            connection.close()


def _allowed_targets(job: JobRecord) -> set[JobStatus]:
    from curalina_variants.api.schemas import ALLOWED_JOB_TRANSITIONS

    return set(ALLOWED_JOB_TRANSITIONS[job.status])
