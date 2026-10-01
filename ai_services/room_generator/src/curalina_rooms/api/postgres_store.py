"""Postgres-backed durable store for room-generator A3 jobs.

Schema is owned by the checked-in Alembic migrations under
`migrations/versions/` (see `curalina_rooms.db.migrator`), not by this
module — `initialize()` runs those migrations rather than issuing ad hoc
`CREATE TABLE IF NOT EXISTS` statements.
"""

from __future__ import annotations

import hashlib
import json
from collections.abc import Iterator
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

import psycopg
from psycopg.rows import dict_row

from curalina_rooms.api.errors import (
    invalid_job_state_error,
    missing_reference_image_error,
    resource_not_found_error,
    review_version_conflict_error,
    stale_bundle_revision_error,
    unknown_bundle_error,
)
from curalina_rooms.api.fixtures import load_fixture
from curalina_rooms.api.schemas import (
    AssetContentResponse,
    AssetImportRequest,
    AssetResponse,
    CandidateReviewRequest,
    CandidateReviewResponse,
    ErrorResponse,
    JobResult,
    JobStatusResponse,
    RenderJobRequest,
    RenderJobResponse,
)
from curalina_rooms.db.migrator import run_migrations


class LeaseConflictError(RuntimeError):
    """Raised when a worker tries to complete a job leased by another worker."""


def _dsn_with_schema(database_url: str, schema: str) -> str:
    if not database_url.startswith(("postgresql://", "postgresql+psycopg://")):
        raise ValueError(
            "room A3 only supports postgresql:// database URLs, got "
            f"{database_url!r}"
        )
    bare = "postgresql://" + database_url.split("://", 1)[1]
    if schema == "public":
        return bare
    parsed = urlparse(bare)
    query = dict(parse_qsl(parsed.query))
    query["options"] = f"-csearch_path={schema}"
    return urlunparse(parsed._replace(query=urlencode(query)))


def _utc_now() -> datetime:
    return datetime.now(UTC)


def _utc_now_iso() -> str:
    return _utc_now().strftime("%Y-%m-%dT%H:%M:%SZ")


def _parse_datetime(value: str | None) -> datetime | None:
    if value is None:
        return None
    parsed = datetime.fromisoformat(value)
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=UTC)
    return parsed


def _model_json(model: object) -> str:
    assert hasattr(model, "model_dump_json")
    return str(model.model_dump_json())


def _content_hash(request: AssetImportRequest) -> str:
    digest_source = "|".join(
        [
            request.owner_id,
            request.original_filename,
            str(request.content_length),
            request.upstream_asset_id or "",
        ]
    ).encode("utf-8")
    return "sha256:" + hashlib.sha256(digest_source).hexdigest()


@dataclass(frozen=True, slots=True)
class LeasedJobContext:
    job: JobStatusResponse
    request: RenderJobRequest
    max_attempts: int


@dataclass(frozen=True, slots=True)
class PostgresRoomStore:
    database_url: str
    schema: str = "public"

    @classmethod
    def from_database_url(
        cls, database_url: str, *, schema: str = "public"
    ) -> PostgresRoomStore:
        _dsn_with_schema(database_url, schema)  # eager validation
        return cls(database_url=database_url, schema=schema)

    def initialize(self) -> None:
        run_migrations(self.database_url, schema=self.schema)

    def seed_from_fixtures(self) -> None:
        with self._connect() as connection:
            for bundle in load_fixture("bundle_snapshots.json")["bundles"]:
                connection.execute(
                    """
                    INSERT INTO bundles (bundle_id, current_revision)
                    VALUES (%s, %s)
                    ON CONFLICT (bundle_id) DO NOTHING
                    """,
                    (bundle["bundle_id"], bundle["current_revision"]),
                )
            for asset in load_fixture("seed_assets.json")["assets"]:
                response = AssetResponse.model_validate(asset)
                connection.execute(
                    """
                    INSERT INTO assets (asset_id, record_json)
                    VALUES (%s, %s)
                    ON CONFLICT (asset_id) DO NOTHING
                    """,
                    (response.asset_id, _model_json(response)),
                )
            for candidate in load_fixture("seed_candidates.json")["candidates"]:
                candidate_id = str(candidate["candidate_id"])
                revision = int(candidate["revision"])
                connection.execute(
                    """
                    INSERT INTO candidates
                        (candidate_id, revision, record_json)
                    VALUES (%s, %s, %s)
                    ON CONFLICT (candidate_id) DO NOTHING
                    """,
                    (
                        candidate_id,
                        revision,
                        json.dumps(
                            {"candidate_id": candidate_id, "revision": revision}
                        ),
                    ),
                )

    def import_asset(
        self, request: AssetImportRequest, *, request_id: str
    ) -> AssetResponse:
        del request_id
        asset_id = self._next_id("assets", "asset_id", "asset")
        response = AssetResponse(
            asset_id=asset_id,
            upstream_asset_id=request.upstream_asset_id,
            owner_id=request.owner_id,
            content_hash=_content_hash(request),
            media_type=request.media_type,
            original_filename=request.original_filename,
            provenance=request.provenance,
            created_at=_utc_now_iso(),
        )
        with self._connect() as connection:
            connection.execute(
                "INSERT INTO assets (asset_id, record_json) VALUES (%s, %s)",
                (asset_id, _model_json(response)),
            )
        return response

    def get_asset_content(
        self, asset_id: str, *, request_id: str
    ) -> AssetContentResponse:
        asset = self._get_asset(
            asset_id, request_id=request_id, missing_reference=False
        )
        return AssetContentResponse(
            asset_id=asset.asset_id,
            content_hash=asset.content_hash,
            media_type=asset.media_type,
            byte_size=1,
            content_ref=f"content://assets/{asset.asset_id}",
        )

    def create_render_job(
        self,
        request: RenderJobRequest,
        *,
        request_id: str,
        max_attempts: int,
        failure_after_insertions: int | None = None,
    ) -> RenderJobResponse:
        # Concept renders (`render_brief` without a bundle) skip bundle and
        # reference checks; anything that does supply them is still checked.
        if request.bundle is not None:
            current_revision = self._current_bundle_revision(
                request.bundle.bundle_id, request_id=request_id
            )
            if current_revision != request.bundle.bundle_revision:
                raise stale_bundle_revision_error(
                    request_id,
                    request.bundle.bundle_id,
                    request.bundle.bundle_revision,
                    current_revision,
                )
        for reference in request.reference_images or []:
            self._get_asset(reference.asset_id, request_id=request_id)

        job_id = self._next_id("jobs", "job_id", "job")
        response = RenderJobResponse(
            job_id=job_id,
            location=f"/v1/jobs/{job_id}",
            bundle_id=request.bundle.bundle_id if request.bundle else None,
            bundle_revision=(
                request.bundle.bundle_revision if request.bundle else None
            ),
            created_at=_utc_now_iso(),
        )
        status = JobStatusResponse(job_id=job_id, status="queued", attempt_count=0)
        with self._connect() as connection:
            connection.execute(
                """
                INSERT INTO jobs (
                    job_id, record_json, request_json, max_attempts,
                    failure_after_insertions, lease_owner, leased_until
                )
                VALUES (%s, %s, %s, %s, %s, NULL, NULL)
                """,
                (
                    job_id,
                    _model_json(status),
                    request.model_dump_json(),
                    max_attempts,
                    failure_after_insertions,
                ),
            )
        return response

    def get_job(self, job_id: str, *, request_id: str) -> JobStatusResponse:
        with self._connect() as connection:
            row = connection.execute(
                "SELECT record_json FROM jobs WHERE job_id = %s", (job_id,)
            ).fetchone()
        if row is None:
            raise resource_not_found_error(request_id, "job", job_id)
        return JobStatusResponse.model_validate_json(str(row["record_json"]))

    def cancel_job(self, job_id: str, *, request_id: str) -> None:
        job = self.get_job(job_id, request_id=request_id)
        if job.status in {"succeeded", "failed", "cancelled"}:
            raise invalid_job_state_error(request_id, job_id, job.status, "cancel")
        cancelled = JobStatusResponse(
            job_id=job_id,
            status="cancelled",
            attempt_count=job.attempt_count,
            result=job.result,
            error=job.error,
        )
        self._save_job(cancelled, clear_lease=True)

    def create_review(
        self,
        candidate_id: str,
        request: CandidateReviewRequest,
        *,
        request_id: str,
    ) -> CandidateReviewResponse:
        with self._connect() as connection:
            row = connection.execute(
                "SELECT revision FROM candidates WHERE candidate_id = %s",
                (candidate_id,),
            ).fetchone()
            if row is None:
                raise resource_not_found_error(request_id, "candidate", candidate_id)
            current_revision = int(row["revision"])
            if request.expected_revision != current_revision:
                raise review_version_conflict_error(
                    request_id,
                    candidate_id,
                    request.expected_revision,
                    current_revision,
                )
            next_revision = current_revision + 1
            review_id = self._next_id_with_connection(
                connection, "reviews", "review_id", "review"
            )
            response = CandidateReviewResponse(
                review_id=review_id,
                candidate_id=candidate_id,
                reviewer_id=request.reviewer_id,
                decision=request.decision,
                revision=next_revision,
                created_at=_utc_now_iso(),
            )
            connection.execute(
                """
                UPDATE candidates
                SET revision = %s, record_json = %s
                WHERE candidate_id = %s
                """,
                (
                    next_revision,
                    json.dumps(
                        {"candidate_id": candidate_id, "revision": next_revision}
                    ),
                    candidate_id,
                ),
            )
            connection.execute(
                """
                INSERT INTO reviews (review_id, candidate_id, record_json)
                VALUES (%s, %s, %s)
                """,
                (review_id, candidate_id, _model_json(response)),
            )
        return response

    def lease_next_job(
        self, *, worker_id: str, lease_seconds: int
    ) -> JobStatusResponse | None:
        now = _utc_now()
        lease_deadline = now + timedelta(seconds=lease_seconds)
        with self._connect() as connection:
            rows = connection.execute(
                "SELECT job_id, record_json, leased_until FROM jobs ORDER BY job_id"
            ).fetchall()
            for row in rows:
                job = JobStatusResponse.model_validate_json(str(row["record_json"]))
                leased_until = _parse_datetime(row["leased_until"])
                lease_expired = leased_until is None or leased_until <= now
                if job.status not in {"queued", "running"}:
                    continue
                if job.status == "running" and not lease_expired:
                    continue
                if job.status == "queued":
                    job = JobStatusResponse(
                        job_id=job.job_id,
                        status="running",
                        attempt_count=job.attempt_count,
                        result=job.result,
                        error=job.error,
                    )
                connection.execute(
                    """
                    UPDATE jobs
                    SET record_json = %s, lease_owner = %s, leased_until = %s
                    WHERE job_id = %s
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
        request_id: str = "worker",
    ) -> JobStatusResponse:
        with self._connect() as connection:
            row = connection.execute(
                """
                SELECT record_json, request_json, max_attempts,
                       failure_after_insertions, lease_owner
                FROM jobs
                WHERE job_id = %s
                """,
                (job_id,),
            ).fetchone()
            if row is None:
                raise resource_not_found_error(request_id, "job", job_id)
            if row["lease_owner"] != worker_id:
                raise LeaseConflictError(job_id)
            job = JobStatusResponse.model_validate_json(str(row["record_json"]))
            if job.status != "running":
                raise invalid_job_state_error(
                    request_id, job_id, job.status, "complete"
                )
            max_attempts = int(row["max_attempts"])
            attempt_count = job.attempt_count + 1
            if attempt_count > max_attempts:
                failed = self._failed_job(
                    job_id=job_id,
                    attempt_count=attempt_count,
                    code="max_attempts_exceeded",
                    message="Render job exceeded its configured attempt bound.",
                )
                self._save_job_with_connection(connection, failed, clear_lease=True)
                return failed
            request = RenderJobRequest.model_validate_json(str(row["request_json"]))
            failure_after = row["failure_after_insertions"]
            candidate_id = self._next_id_with_connection(
                connection, "candidates", "candidate_id", "cand"
            )
            staged = self._stage_insertions(
                connection,
                job_id=job_id,
                request=request,
                candidate_id=candidate_id,
                failure_after_insertions=(
                    None if failure_after is None else int(failure_after)
                ),
            )
            if staged < len(request.instances or []):
                failed = self._failed_job(
                    job_id=job_id,
                    attempt_count=attempt_count,
                    code="fake_grounded_generation_failed",
                    message=(
                        "Fake grounded generation stopped after a staged insertion."
                    ),
                )
                self._save_job_with_connection(connection, failed, clear_lease=True)
                return failed
            connection.execute(
                """
                INSERT INTO candidates (candidate_id, revision, record_json)
                VALUES (%s, %s, %s)
                """,
                (
                    candidate_id,
                    1,
                    json.dumps({"candidate_id": candidate_id, "revision": 1}),
                ),
            )
            succeeded = JobStatusResponse(
                job_id=job_id,
                status="succeeded",
                attempt_count=attempt_count,
                result=JobResult(
                    candidate_id=candidate_id,
                    outcome_counts={
                        "insertions_staged": staged,
                        "absent": 0,
                        "extra": 0,
                        "wrong_identity": 0,
                        "wrong_colour": 0,
                        "distorted_geometry": 0,
                        "altered_architecture": 0,
                    },
                ),
            )
            self._save_job_with_connection(connection, succeeded, clear_lease=True)
            return succeeded

    # -- Concept-render (worker) support ---------------------------------

    def get_leased_job_context(
        self, job_id: str, *, worker_id: str, request_id: str = "worker"
    ) -> LeasedJobContext:
        with self._connect() as connection:
            job, request, max_attempts = self._load_leased(
                connection, job_id, worker_id=worker_id, request_id=request_id
            )
        return LeasedJobContext(
            job=job, request=request, max_attempts=max_attempts
        )

    def renew_lease(
        self, job_id: str, *, worker_id: str, lease_seconds: int
    ) -> bool:
        """Extend the lease if `worker_id` still owns a running job."""
        deadline = (_utc_now() + timedelta(seconds=lease_seconds)).isoformat()
        with self._connect() as connection:
            cursor = connection.execute(
                """
                UPDATE jobs SET leased_until = %s
                WHERE job_id = %s AND lease_owner = %s
                """,
                (deadline, job_id, worker_id),
            )
            return cursor.rowcount == 1

    def complete_concept_job(
        self,
        job_id: str,
        *,
        worker_id: str,
        asset: AssetResponse,
        result: JobResult,
        request_id: str = "worker",
    ) -> JobStatusResponse:
        """Register the (already written) output asset and mark the job
        succeeded in one transaction."""
        with self._connect() as connection:
            job, _, _ = self._load_leased(
                connection, job_id, worker_id=worker_id, request_id=request_id
            )
            connection.execute(
                """
                INSERT INTO assets (asset_id, record_json) VALUES (%s, %s)
                ON CONFLICT (asset_id) DO UPDATE SET record_json = EXCLUDED.record_json
                """,
                (asset.asset_id, _model_json(asset)),
            )
            succeeded = JobStatusResponse(
                job_id=job_id,
                status="succeeded",
                attempt_count=job.attempt_count + 1,
                result=result,
            )
            self._save_job_with_connection(connection, succeeded, clear_lease=True)
            return succeeded

    def fail_leased_job(
        self,
        job_id: str,
        *,
        worker_id: str,
        code: str,
        message: str,
        retryable: bool,
        details: dict[str, Any] | None = None,
        request_id: str = "worker",
    ) -> JobStatusResponse:
        with self._connect() as connection:
            job, _, _ = self._load_leased(
                connection, job_id, worker_id=worker_id, request_id=request_id
            )
            failed = JobStatusResponse(
                job_id=job_id,
                status="failed",
                attempt_count=job.attempt_count + 1,
                error=ErrorResponse(
                    code=code,
                    message=message,
                    details={"job_id": job_id, **(details or {})},
                    retryable=retryable,
                    request_id="worker",
                ),
            )
            self._save_job_with_connection(connection, failed, clear_lease=True)
            return failed

    def _load_leased(
        self,
        connection: psycopg.Connection[Any],
        job_id: str,
        *,
        worker_id: str,
        request_id: str,
    ) -> tuple[JobStatusResponse, RenderJobRequest, int]:
        row = connection.execute(
            """
            SELECT record_json, request_json, max_attempts, lease_owner
            FROM jobs WHERE job_id = %s
            """,
            (job_id,),
        ).fetchone()
        if row is None:
            raise resource_not_found_error(request_id, "job", job_id)
        if row["lease_owner"] != worker_id:
            raise LeaseConflictError(job_id)
        job = JobStatusResponse.model_validate_json(str(row["record_json"]))
        if job.status != "running":
            raise invalid_job_state_error(request_id, job_id, job.status, "complete")
        request = RenderJobRequest.model_validate_json(str(row["request_json"]))
        return job, request, int(row["max_attempts"])

    def staged_insertions_for_job(self, job_id: str) -> tuple[dict[str, Any], ...]:
        with self._connect() as connection:
            rows = connection.execute(
                """
                SELECT stage_index, instance_id, artifact_asset_id
                FROM staged_insertions
                WHERE job_id = %s
                ORDER BY stage_index
                """,
                (job_id,),
            ).fetchall()
        return tuple(dict(row) for row in rows)

    def _stage_insertions(
        self,
        connection: psycopg.Connection[Any],
        *,
        job_id: str,
        request: RenderJobRequest,
        candidate_id: str,
        failure_after_insertions: int | None,
    ) -> int:
        staged = 0
        for index, instance in enumerate(request.instances or []):
            self._validate_existing_stages(connection, job_id=job_id, upto=index)
            if (
                failure_after_insertions is not None
                and staged >= failure_after_insertions
            ):
                break
            connection.execute(
                """
                INSERT INTO staged_insertions
                    (job_id, stage_index, instance_id, artifact_asset_id)
                VALUES (%s, %s, %s, %s)
                """,
                (
                    job_id,
                    index,
                    instance.instance_id,
                    f"asset_room_stage_{candidate_id[5:]}_{index + 1:03d}",
                ),
            )
            staged += 1
        return staged

    def _validate_existing_stages(
        self, connection: psycopg.Connection[Any], *, job_id: str, upto: int
    ) -> None:
        count = connection.execute(
            """
            SELECT COUNT(*) AS count FROM staged_insertions
            WHERE job_id = %s AND stage_index < %s
            """,
            (job_id, upto),
        ).fetchone()
        assert count is not None
        if int(count["count"]) != upto:
            raise RuntimeError(f"render job {job_id!r} has missing staged insertions")

    def _failed_job(
        self, *, job_id: str, attempt_count: int, code: str, message: str
    ) -> JobStatusResponse:
        return JobStatusResponse(
            job_id=job_id,
            status="failed",
            attempt_count=attempt_count,
            error=ErrorResponse(
                code=code,
                message=message,
                details={"job_id": job_id},
                retryable=False,
                request_id="worker",
            ),
        )

    def _current_bundle_revision(self, bundle_id: str, *, request_id: str) -> str:
        with self._connect() as connection:
            row = connection.execute(
                "SELECT current_revision FROM bundles WHERE bundle_id = %s",
                (bundle_id,),
            ).fetchone()
        if row is None:
            raise unknown_bundle_error(request_id, bundle_id)
        return str(row["current_revision"])

    def _get_asset(
        self, asset_id: str, *, request_id: str, missing_reference: bool = True
    ) -> AssetResponse:
        with self._connect() as connection:
            row = connection.execute(
                "SELECT record_json FROM assets WHERE asset_id = %s", (asset_id,)
            ).fetchone()
        if row is None:
            if missing_reference:
                raise missing_reference_image_error(request_id, asset_id)
            raise resource_not_found_error(request_id, "asset", asset_id)
        return AssetResponse.model_validate_json(str(row["record_json"]))

    def _save_job(self, job: JobStatusResponse, *, clear_lease: bool) -> None:
        with self._connect() as connection:
            self._save_job_with_connection(connection, job, clear_lease=clear_lease)

    def _save_job_with_connection(
        self,
        connection: psycopg.Connection[Any],
        job: JobStatusResponse,
        *,
        clear_lease: bool,
    ) -> None:
        if clear_lease:
            connection.execute(
                """
                UPDATE jobs
                SET record_json = %s, lease_owner = NULL, leased_until = NULL
                WHERE job_id = %s
                """,
                (_model_json(job), job.job_id),
            )
        else:
            connection.execute(
                "UPDATE jobs SET record_json = %s WHERE job_id = %s",
                (_model_json(job), job.job_id),
            )

    def _next_id(self, table: str, column: str, prefix: str) -> str:
        with self._connect() as connection:
            return self._next_id_with_connection(connection, table, column, prefix)

    def _next_id_with_connection(
        self, connection: psycopg.Connection[Any], table: str, column: str, prefix: str
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
    def _connect(self) -> Iterator[psycopg.Connection[Any]]:
        connection = psycopg.connect(
            _dsn_with_schema(self.database_url, self.schema), row_factory=dict_row
        )
        try:
            with connection:
                yield connection
        finally:
            connection.close()
