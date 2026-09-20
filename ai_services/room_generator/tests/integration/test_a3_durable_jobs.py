from __future__ import annotations

from pathlib import Path

import pytest

from curalina_rooms.api.errors import ContractError
from curalina_rooms.api.fixtures import load_fixture
from curalina_rooms.api.schemas import AssetImportRequest, RenderJobRequest
from curalina_rooms.api.service import RoomsContractService
from curalina_rooms.api.sqlite_store import LeaseConflictError, SQLiteRoomStore
from curalina_rooms.settings import Settings
from curalina_rooms.workers import process_one_job, run_worker_once


def _store(tmp_path: Path) -> SQLiteRoomStore:
    store = SQLiteRoomStore(tmp_path / "rooms.sqlite3")
    store.initialize()
    store.seed_from_fixtures()
    return store


def _service(
    store: SQLiteRoomStore, *, failure_after: int | None = None
) -> RoomsContractService:
    return RoomsContractService(store, failure_after_insertions=failure_after)


def _create_job(service: RoomsContractService) -> str:
    created = service.create_render_job(load_fixture("render_job_request_valid.json"))
    return created.body.job_id


def test_sqlite_job_survives_restart_and_worker_completion(tmp_path: Path) -> None:
    store = _store(tmp_path)
    job_id = _create_job(_service(store))

    restarted_store = SQLiteRoomStore(tmp_path / "rooms.sqlite3")
    restarted_store.initialize()
    result = process_one_job(
        restarted_store, worker_id="worker-restart", lease_seconds=60
    )

    assert result.processed is True
    assert result.job is not None
    assert result.job.job_id == job_id
    assert result.job.status == "succeeded"
    assert result.job.result is not None
    assert result.job.result.candidate_id == "cand_000001"


def test_reference_import_hash_is_available_to_render_jobs(tmp_path: Path) -> None:
    store = _store(tmp_path)
    service = _service(store)
    payload = load_fixture("asset_import_request.json")
    imported = service.import_asset(payload)

    assert imported.body.content_hash.startswith("sha256:")

    render_payload = load_fixture("render_job_request_valid.json")
    render_payload = {
        **render_payload,
        "reference_images": [
            {"asset_id": "asset_room000001", "role": "room_photo"},
            {"asset_id": imported.body.asset_id, "role": "hero_product"},
        ],
    }
    created = service.create_render_job(render_payload)

    assert created.body.job_id == "job_000001"
    content = service.get_asset_content(imported.body.asset_id)
    assert content.body.content_hash == imported.body.content_hash


def test_missing_reference_fails_before_job_is_persisted(tmp_path: Path) -> None:
    store = _store(tmp_path)
    service = _service(store)

    with pytest.raises(ContractError) as excinfo:
        service.create_render_job(
            load_fixture("render_job_request_missing_reference.json")
        )

    assert excinfo.value.http_status == 422
    assert excinfo.value.error.code == "missing_reference_image"
    assert store.lease_next_job(worker_id="worker-empty", lease_seconds=60) is None


def test_cancelled_job_is_not_completed_by_worker(tmp_path: Path) -> None:
    store = _store(tmp_path)
    service = _service(store)
    job_id = _create_job(service)

    cancelled = service.cancel_job(job_id)

    assert cancelled.body.status == "cancelled"
    worker_result = process_one_job(store, worker_id="worker-cancel", lease_seconds=60)
    assert worker_result.processed is False
    assert service.get_job(job_id).body.status == "cancelled"


def test_lease_expiry_allows_restart_recovery(tmp_path: Path) -> None:
    store = _store(tmp_path)
    job_id = _create_job(_service(store))

    leased = store.lease_next_job(worker_id="dead-worker", lease_seconds=-1)
    assert leased is not None
    assert leased.job_id == job_id

    recovered = process_one_job(store, worker_id="recovery-worker", lease_seconds=60)

    assert recovered.processed is True
    assert recovered.job is not None
    assert recovered.job.status == "succeeded"


def test_wrong_worker_cannot_complete_leased_job(tmp_path: Path) -> None:
    store = _store(tmp_path)
    job_id = _create_job(_service(store))
    leased = store.lease_next_job(worker_id="right-worker", lease_seconds=60)

    assert leased is not None
    with pytest.raises(LeaseConflictError):
        store.complete_leased_job(job_id, worker_id="wrong-worker")


def test_partial_artifacts_remain_after_fake_generation_failure(tmp_path: Path) -> None:
    store = _store(tmp_path)
    job_id = _create_job(_service(store, failure_after=1))

    result = process_one_job(store, worker_id="worker-partial", lease_seconds=60)

    assert result.processed is True
    assert result.job is not None
    assert result.job.status == "failed"
    assert result.job.error is not None
    assert result.job.error.code == "fake_grounded_generation_failed"
    staged = store.staged_insertions_for_job(job_id)
    assert len(staged) == 1
    assert staged[0]["instance_id"] == "inst_sofa_1"


def test_run_worker_once_returns_one_when_no_job_is_available(tmp_path: Path) -> None:
    settings = Settings(CURALINA_DATABASE_URL=f"sqlite:///{tmp_path / 'rooms.sqlite3'}")

    assert run_worker_once(settings, worker_id="worker-empty") == 1


def test_store_rejects_unsupported_database_url() -> None:
    with pytest.raises(ValueError, match="sqlite"):
        SQLiteRoomStore.from_database_url("postgresql://rooms")


def test_raw_store_contract_can_create_asset_and_job(tmp_path: Path) -> None:
    store = _store(tmp_path)
    asset = store.import_asset(
        AssetImportRequest.model_validate(load_fixture("asset_import_request.json")),
        request_id="req-asset",
    )
    request = RenderJobRequest.model_validate(
        load_fixture("render_job_request_valid.json")
    )
    request = request.model_copy(
        update={
            "reference_images": [
                request.reference_images[0],
                request.reference_images[1].model_copy(
                    update={"asset_id": asset.asset_id}
                ),
            ]
        }
    )

    created = store.create_render_job(request, request_id="req-job", max_attempts=3)

    assert created.job_id == "job_000001"
