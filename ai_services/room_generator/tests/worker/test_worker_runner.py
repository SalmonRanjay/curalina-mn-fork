from __future__ import annotations

from pathlib import Path

from curalina_rooms.api.fixtures import load_fixture
from curalina_rooms.api.service import RoomsContractService
from curalina_rooms.api.sqlite_store import SQLiteRoomStore
from curalina_rooms.workers import process_one_job


def test_worker_processes_one_queued_sqlite_render_job(tmp_path: Path) -> None:
    store = SQLiteRoomStore(tmp_path / "rooms.sqlite3")
    store.initialize()
    store.seed_from_fixtures()
    service = RoomsContractService(store)
    created = service.create_render_job(load_fixture("render_job_request_valid.json"))

    result = process_one_job(store, worker_id="worker-test", lease_seconds=60)

    assert result.processed is True
    assert result.job is not None
    assert result.job.job_id == created.body.job_id
    assert result.job.status == "succeeded"
