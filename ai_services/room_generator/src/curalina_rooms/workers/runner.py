"""Worker entry points for durable room render jobs."""

from __future__ import annotations

from dataclasses import dataclass

from curalina_rooms.api.schemas import JobStatusResponse
from curalina_rooms.api.sqlite_store import SQLiteRoomStore
from curalina_rooms.settings import Settings


@dataclass(frozen=True, slots=True)
class WorkerResult:
    processed: bool
    job: JobStatusResponse | None = None


def process_one_job(
    store: SQLiteRoomStore,
    *,
    worker_id: str,
    lease_seconds: int,
) -> WorkerResult:
    job = store.lease_next_job(worker_id=worker_id, lease_seconds=lease_seconds)
    if job is None:
        return WorkerResult(processed=False)
    completed = store.complete_leased_job(job.job_id, worker_id=worker_id)
    return WorkerResult(processed=True, job=completed)


def run_worker_once(settings: Settings, *, worker_id: str = "worker_local") -> int:
    store = SQLiteRoomStore.from_database_url(settings.curalina_database_url)
    store.initialize()
    store.seed_from_fixtures()
    result = process_one_job(
        store,
        worker_id=worker_id,
        lease_seconds=settings.curalina_job_timeout_seconds,
    )
    return 0 if result.processed else 1
