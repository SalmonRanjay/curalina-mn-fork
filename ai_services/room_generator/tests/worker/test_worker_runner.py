from __future__ import annotations

import hashlib
import os
from pathlib import Path

from curalina_rooms.api.fixtures import load_fixture
from curalina_rooms.api.postgres_store import PostgresRoomStore
from curalina_rooms.api.service import RoomsContractService
from curalina_rooms.workers import process_one_job

_TEST_DATABASE_URL = os.environ.get(
    "CURALINA_TEST_DATABASE_URL",
    "postgresql://curalina:curalina_dev_password@localhost:5432/curalina_rooms_test",
)


def _schema_for(tmp_path: Path) -> str:
    digest = hashlib.sha256(str(tmp_path).encode("utf-8")).hexdigest()[:16]
    return f"test_{digest}"


def test_worker_processes_one_queued_postgres_render_job(tmp_path: Path) -> None:
    store = PostgresRoomStore(_TEST_DATABASE_URL, schema=_schema_for(tmp_path))
    store.initialize()
    store.seed_from_fixtures()
    service = RoomsContractService(store)
    created = service.create_render_job(load_fixture("render_job_request_valid.json"))

    result = process_one_job(store, worker_id="worker-test", lease_seconds=60)

    assert result.processed is True
    assert result.job is not None
    assert result.job.job_id == created.body.job_id
    assert result.job.status == "succeeded"
