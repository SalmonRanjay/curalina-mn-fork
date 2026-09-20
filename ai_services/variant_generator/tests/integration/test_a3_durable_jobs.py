from __future__ import annotations

import base64
import sqlite3
import subprocess
import sys
from contextlib import closing
from io import BytesIO
from pathlib import Path

import numpy as np
import pytest
from fastapi.testclient import TestClient
from PIL import Image

from curalina_variants.api import create_app
from curalina_variants.api.errors import ApiError
from curalina_variants.api.fixtures import load_fixture
from curalina_variants.api.schemas import (
    AssetContent,
    CreateAssetRequest,
    CreateMaskRequest,
    CreateVariantJobRequest,
    JobStatus,
)
from curalina_variants.api.sqlite_store import LeaseConflictError, SQLiteJobStore
from curalina_variants.workers import process_one_job


def _png_bytes(rgb: np.ndarray) -> bytes:
    """Encode a numpy RGB array as PNG bytes."""
    output = BytesIO()
    Image.fromarray(rgb.astype(np.uint8), mode="RGB").save(output, format="PNG")
    return output.getvalue()


@pytest.fixture
def store(tmp_path: Path) -> SQLiteJobStore:
    result = SQLiteJobStore(tmp_path / "variants.sqlite3")
    result.initialize()
    # Seed the default asset and mask that test fixtures expect
    try:
        # Create a real fixture asset: a 2x2 PNG with uniform grey pixels
        fixture_rgb = np.array(
            [
                [[128, 128, 128], [128, 128, 128]],
                [[128, 128, 128], [128, 128, 128]],
            ],
            dtype=np.uint8,
        )
        fixture_bytes = _png_bytes(fixture_rgb)
        asset_request = CreateAssetRequest(
            owner_id="fixture_owner",
            original_filename="fixture.png",
            media_type="image/png",
            content_bytes=fixture_bytes,
        )
        result.create_asset(asset_request, request_id="fixture-setup")
    except Exception:
        # If asset already exists, that's fine
        pass

    try:
        mask_request = CreateMaskRequest(
            mask_id="mask_000001",
            source_asset_id="asset_000001",
            width_px=2,
            height_px=2,
            editable_mask_b64=base64.b64encode(bytes([1, 1, 1, 1])).decode("utf-8"),
            protected_subregions=[],
            feather_band_px=3,
            human_corrected=False,
            revision=1,
        )
        result.create_mask(mask_request, request_id="fixture-setup")
    except Exception:
        # If mask already exists, that's fine - we're just ensuring it's there
        pass
    return result


def _create(store: SQLiteJobStore) -> str:
    request = CreateVariantJobRequest.model_validate(
        load_fixture("create_variant_job_request")
    )
    job, _ = store.create_variant_job(
        request, idempotency_key="synthetic-a3", request_id="integration"
    )
    return job.job_id


def _expire(store: SQLiteJobStore, job_id: str) -> None:
    with closing(sqlite3.connect(store.db_path)) as connection, connection:
        connection.execute(
            "UPDATE jobs SET leased_until = ? WHERE job_id = ?",
            ("2000-01-01T00:00:00+00:00", job_id),
        )


def _candidate_count(store: SQLiteJobStore) -> int:
    with closing(sqlite3.connect(store.db_path)) as connection, connection:
        return int(connection.execute("SELECT count(*) FROM candidates").fetchone()[0])


def test_expired_lease_recovers_and_fences_stale_worker(store: SQLiteJobStore) -> None:
    job_id = _create(store)
    assert store.lease_next_job(worker_id="old", lease_seconds=3600) is not None
    restarted = SQLiteJobStore(store.db_path)
    assert restarted.lease_next_job(worker_id="new", lease_seconds=60) is None
    _expire(store, job_id)
    recovered = restarted.lease_next_job(worker_id="new", lease_seconds=60)
    assert recovered is not None and recovered.job_id == job_id
    with pytest.raises(LeaseConflictError):
        store.complete_leased_job(job_id, worker_id="old")
    assert _candidate_count(store) == 0
    completed = restarted.complete_leased_job(job_id, worker_id="new")
    assert completed.status == JobStatus.SUCCEEDED
    assert SQLiteJobStore(store.db_path).get_job(job_id, request_id="read") == completed
    assert _candidate_count(store) == 1


def test_worker_process_dies_after_claim_and_restart_recovers(
    store: SQLiteJobStore,
) -> None:
    job_id = _create(store)
    child = subprocess.run(
        [
            sys.executable,
            "-c",
            "import os, sys; from pathlib import Path; "
            "from curalina_variants.api.sqlite_store import SQLiteJobStore; "
            "s = SQLiteJobStore(Path(sys.argv[1])); "
            "assert s.lease_next_job(worker_id='dead', lease_seconds=3600); "
            "os._exit(23)",
            str(store.db_path),
        ],
        capture_output=True,
        text=True,
        timeout=15,
        check=False,
    )
    assert child.returncode == 23, child.stderr
    restarted = SQLiteJobStore(store.db_path)
    assert restarted.get_job(job_id, request_id="read").status == JobStatus.RUNNING
    assert not process_one_job(restarted, worker_id="new", lease_seconds=60).processed
    _expire(store, job_id)
    result = process_one_job(restarted, worker_id="new", lease_seconds=60)
    assert result.processed and result.job is not None
    assert result.job.job_id == job_id and result.job.status == JobStatus.SUCCEEDED
    assert not process_one_job(restarted, worker_id="new", lease_seconds=60).processed
    assert _candidate_count(restarted) == 1


def test_changed_idempotency_payload_after_restart_returns_409(
    store: SQLiteJobStore,
) -> None:
    payload = load_fixture("create_variant_job_request")
    headers = {"Idempotency-Key": "synthetic-a3"}
    with TestClient(create_app(store)) as client:
        created = client.post("/v1/jobs", json=payload, headers=headers)
    assert created.status_code == 202
    with TestClient(create_app(SQLiteJobStore(store.db_path))) as client:
        replay = client.post("/v1/jobs", json=payload, headers=headers)
        changed = client.post(
            "/v1/jobs", json={**payload, "target_colour": "#FFFFFF"}, headers=headers
        )
    assert replay.json()["job_id"] == created.json()["job_id"]
    assert changed.status_code == 409
    assert changed.json()["code"] == "idempotency_conflict"


def test_cancellation_before_completion_rejects_worker(store: SQLiteJobStore) -> None:
    job_id = _create(store)
    assert store.lease_next_job(worker_id="worker", lease_seconds=60) is not None
    SQLiteJobStore(store.db_path).cancel_job(job_id, request_id="cancel")
    with pytest.raises(LeaseConflictError):
        store.complete_leased_job(job_id, worker_id="worker")
    assert store.get_job(job_id, request_id="read").status == JobStatus.CANCELLED
    assert _candidate_count(store) == 0


def test_completion_before_cancellation_preserves_success(
    store: SQLiteJobStore,
) -> None:
    job_id = _create(store)
    process_one_job(store, worker_id="worker", lease_seconds=60)
    with pytest.raises(ApiError) as error:
        SQLiteJobStore(store.db_path).cancel_job(job_id, request_id="cancel")
    assert error.value.status_code == 409
    assert store.get_job(job_id, request_id="read").status == JobStatus.SUCCEEDED
    assert _candidate_count(store) == 1


def test_cancellation_after_completion_read_cannot_resurrect_job(
    store: SQLiteJobStore, monkeypatch: pytest.MonkeyPatch,
) -> None:
    job_id = _create(store)
    assert store.lease_next_job(worker_id="worker", lease_seconds=60) is not None
    original = SQLiteJobStore._next_id
    cancel_called = False

    def cancel_once_then_allocate(
        self: SQLiteJobStore, table: str, column: str, prefix: str,
    ) -> str:
        nonlocal cancel_called
        # Trigger cancellation once, between the ownership read and the
        # re-check inside the transaction.
        if not cancel_called:
            cancel_called = True
            SQLiteJobStore(self.db_path).cancel_job(job_id, request_id="racing-cancel")
        return original(self, table, column, prefix)

    monkeypatch.setattr(SQLiteJobStore, "_next_id", cancel_once_then_allocate)
    with pytest.raises(LeaseConflictError):
        store.complete_leased_job(job_id, worker_id="worker")
    assert SQLiteJobStore(store.db_path).get_job(
        job_id, request_id="read"
    ).status == JobStatus.CANCELLED
    assert _candidate_count(store) == 0


def test_candidate_insert_rolls_back_when_final_job_update_fails(
    store: SQLiteJobStore,
) -> None:
    job_id = _create(store)
    assert store.lease_next_job(worker_id="worker", lease_seconds=60) is not None
    with closing(sqlite3.connect(store.db_path)) as connection, connection:
        connection.execute(
            "CREATE TRIGGER fail_completion BEFORE UPDATE ON jobs "
            "WHEN json_extract(NEW.record_json, '$.status') = 'succeeded' "
            "BEGIN SELECT RAISE(ABORT, 'injected final job update failure'); END"
        )
    with pytest.raises(sqlite3.IntegrityError, match="injected final job update"):
        store.complete_leased_job(job_id, worker_id="worker")
    restarted = SQLiteJobStore(store.db_path)
    job = restarted.get_job(job_id, request_id="read")
    assert job.status == JobStatus.RUNNING and job.candidate_id is None
    assert _candidate_count(restarted) == 0
    with closing(sqlite3.connect(store.db_path)) as connection, connection:
        connection.execute("DROP TRIGGER fail_completion")
    _expire(restarted, job_id)
    result = process_one_job(restarted, worker_id="recovery", lease_seconds=60)
    assert result.job is not None and result.job.status == JobStatus.SUCCEEDED
    assert _candidate_count(restarted) == 1


def test_asset_write_succeeds_and_db_commit_fails_rolls_back(
    store: SQLiteJobStore,
) -> None:
    """Asset write + final commit failure rolls back all insertions."""
    job_id = _create(store)
    assert store.lease_next_job(worker_id="worker", lease_seconds=60) is not None
    with closing(sqlite3.connect(store.db_path)) as connection, connection:
        connection.execute(
            "CREATE TRIGGER fail_final_write BEFORE UPDATE ON jobs "
            "WHEN json_extract(NEW.record_json, '$.status') = 'succeeded' "
            "BEGIN SELECT RAISE(ABORT, 'injected asset-write-then-commit-fail'); END"
        )
    with pytest.raises(
        sqlite3.IntegrityError, match="injected asset-write-then-commit-fail"
    ):
        store.complete_leased_job(job_id, worker_id="worker")
    restarted = SQLiteJobStore(store.db_path)
    job = restarted.get_job(job_id, request_id="read")
    assert job.status == JobStatus.RUNNING and job.candidate_id is None
    # Verify no job output asset was persisted (but fixture asset may exist).
    with closing(sqlite3.connect(store.db_path)) as connection, connection:
        asset_count_before = int(
            connection.execute("SELECT count(*) FROM assets").fetchone()[0]
        )
    # Asset count should still be just the fixture asset (1 from the fixture setup)
    assert asset_count_before == 1
    assert _candidate_count(restarted) == 0
    with closing(sqlite3.connect(store.db_path)) as connection, connection:
        connection.execute("DROP TRIGGER fail_final_write")
    _expire(restarted, job_id)
    result = process_one_job(restarted, worker_id="recovery", lease_seconds=60)
    assert result.job is not None and result.job.status == JobStatus.SUCCEEDED
    assert _candidate_count(restarted) == 1
    # Verify job output asset was successfully written on recovery (fixture + 1 new).
    with closing(sqlite3.connect(store.db_path)) as connection, connection:
        asset_count_after = int(
            connection.execute("SELECT count(*) FROM assets").fetchone()[0]
        )
    assert asset_count_after == 2


def test_lease_expired_permits_recovery(store: SQLiteJobStore) -> None:
    """A job with expired lease can be recovered by a new worker."""
    job_id = _create(store)
    store.lease_next_job(worker_id="first", lease_seconds=1)
    # Directly update the lease expiry to the past to trigger the lease_expired
    # branch in lease_next_job.
    _expire(store, job_id)
    recovered = store.lease_next_job(worker_id="second", lease_seconds=60)
    assert recovered is not None and recovered.job_id == job_id
    assert recovered.status == JobStatus.RUNNING
    completed = store.complete_leased_job(job_id, worker_id="second")
    assert completed.status == JobStatus.SUCCEEDED
    assert _candidate_count(store) == 1


def test_stale_claim_rejection_on_expired_lease(
    store: SQLiteJobStore,
) -> None:
    """A worker holding an expired lease cannot complete a job another worker
    has recovered."""
    job_id = _create(store)
    leased_1 = store.lease_next_job(worker_id="first", lease_seconds=1)
    assert leased_1 is not None
    _expire(store, job_id)
    leased_2 = store.lease_next_job(worker_id="second", lease_seconds=60)
    assert leased_2 is not None and leased_2.job_id == job_id
    with pytest.raises(LeaseConflictError):
        store.complete_leased_job(job_id, worker_id="first")
    assert _candidate_count(store) == 0
    completed = store.complete_leased_job(job_id, worker_id="second")
    assert completed.status == JobStatus.SUCCEEDED
    assert _candidate_count(store) == 1


def _read_png(image_bytes: bytes) -> np.ndarray:
    """Decode PNG bytes to numpy RGB array."""
    with Image.open(BytesIO(image_bytes)) as image:
        return np.asarray(image.convert("RGB"), dtype=np.uint8)


def test_worker_applies_real_lab_colour_transfer_with_hard_composite_guarantee(
    store: SQLiteJobStore,
) -> None:
    """Verify that the worker applies the real LabColourTransferAdapter
    and produces output where pixels are byte-identical outside the mask's
    editable region and changed inside it (hard-composite guarantee)."""

    # Create a small synthetic source image: 2x2 with specific colours
    # Top-left (0,0): light grey (240, 240, 240) - protected
    # Top-right (0,1): dark grey (80, 80, 80) - editable
    # Bottom-left (1,0): dark grey (70, 70, 70) - editable
    # Bottom-right (1,1): light grey (240, 240, 240) - protected
    source_rgb = np.array(
        [
            [[240, 240, 240], [80, 80, 80]],
            [[70, 70, 70], [240, 240, 240]],
        ],
        dtype=np.uint8,
    )
    source_bytes = _png_bytes(source_rgb)

    # Create asset for the source image
    asset_request = CreateAssetRequest(
        owner_id="test_owner",
        original_filename="source.png",
        media_type="image/png",
        content_bytes=source_bytes,
    )
    source_asset = store.create_asset(asset_request, request_id="test")
    source_asset_id = source_asset.asset_id

    # Create mask with top-right and bottom-left as editable (1)
    # and top-left and bottom-right as protected (0)
    editable_mask = bytes([0, 1, 1, 0])
    mask_request = CreateMaskRequest(
        mask_id="mask_composite_test",
        source_asset_id=source_asset_id,
        width_px=2,
        height_px=2,
        editable_mask_b64=base64.b64encode(editable_mask).decode("utf-8"),
        protected_subregions=[],
        feather_band_px=0,
        human_corrected=True,
        revision=1,
    )
    store.create_mask(mask_request, request_id="test")

    # Create a job with target colour (e.g., a greenish colour)
    job_request = CreateVariantJobRequest(
        parent_product_id="product_test",
        source_asset_id=source_asset_id,
        mask_id="mask_composite_test",
        target_colour="#1b4d3e",
        owner_id="test_owner",
    )
    job, _ = store.create_variant_job(
        job_request, idempotency_key="composite-test", request_id="test"
    )

    # Process the job - this should invoke the real LabColourTransferAdapter
    result = process_one_job(store, worker_id="test_worker", lease_seconds=60)
    assert result.processed
    assert result.job is not None
    assert result.job.status == JobStatus.SUCCEEDED
    assert result.job.candidate_id is not None

    # Get the output asset and verify the hard-composite guarantee
    candidate = store.get_candidate(result.job.candidate_id, request_id="test")
    assert candidate.variant.output_asset_id is not None
    output_asset = store.get_asset_content(
        candidate.variant.output_asset_id, request_id="test"
    )
    output_rgb = _read_png(output_asset.content_bytes)

    # Verify hard-composite guarantee:
    # Protected pixels (0,0) and (1,1) must be byte-identical to source
    assert np.array_equal(
        output_rgb[0, 0], source_rgb[0, 0]
    ), "Protected pixel (0,0) was modified"
    assert np.array_equal(
        output_rgb[1, 1], source_rgb[1, 1]
    ), "Protected pixel (1,1) was modified"

    # Editable pixels (0,1) and (1,0) should be different (recoloured)
    assert not np.array_equal(
        output_rgb[0, 1], source_rgb[0, 1]
    ), "Editable pixel (0,1) was not modified"
    assert not np.array_equal(
        output_rgb[1, 0], source_rgb[1, 0]
    ), "Editable pixel (1,0) was not modified"

    # Verify output provenance is "generated" not "fake_generated"
    assert candidate.variant.source_asset_id == source_asset_id
    output_asset_record = store.get_asset(
        candidate.variant.output_asset_id, request_id="test"
    )
    assert output_asset_record.provenance == "generated"


def test_worker_fails_job_when_source_asset_not_found(
    store: SQLiteJobStore, monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Verify that when a source asset is not found during transformation,
    the job is marked as failed with a specific error code, not silently
    completed as succeeded."""

    # Create a real source asset and mask
    source_rgb = np.array(
        [
            [[240, 240, 240], [80, 80, 80]],
            [[70, 70, 70], [240, 240, 240]],
        ],
        dtype=np.uint8,
    )
    source_bytes = _png_bytes(source_rgb)
    asset_request = CreateAssetRequest(
        owner_id="test_owner",
        original_filename="source.png",
        media_type="image/png",
        content_bytes=source_bytes,
    )
    source_asset = store.create_asset(asset_request, request_id="test")
    source_asset_id = source_asset.asset_id

    editable_mask = bytes([0, 1, 1, 0])
    mask_request = CreateMaskRequest(
        mask_id="mask_missing_asset_test",
        source_asset_id=source_asset_id,
        width_px=2,
        height_px=2,
        editable_mask_b64=base64.b64encode(editable_mask).decode("utf-8"),
        protected_subregions=[],
        feather_band_px=0,
        human_corrected=True,
        revision=1,
    )
    store.create_mask(mask_request, request_id="test")

    # Create a job that will reference a valid asset at creation time
    job_request = CreateVariantJobRequest(
        parent_product_id="product_test",
        source_asset_id=source_asset_id,
        mask_id="mask_missing_asset_test",
        target_colour="#1b4d3e",
        owner_id="test_owner",
    )
    job, _ = store.create_variant_job(
        job_request, idempotency_key="missing-asset-runtime-test", request_id="test"
    )

    # Monkey-patch get_asset_content to simulate asset lookup failure
    original_get_asset_content = SQLiteJobStore.get_asset_content

    def mock_get_asset_content(
        self: SQLiteJobStore, asset_id: str, *, request_id: str
    ) -> AssetContent:
        if asset_id == source_asset_id:
            # Simulate asset not found by raising an exception
            from curalina_variants.api.errors import not_found_error

            raise not_found_error(request_id, resource="asset", resource_id=asset_id)
        return original_get_asset_content(self, asset_id, request_id=request_id)

    monkeypatch.setattr(SQLiteJobStore, "get_asset_content", mock_get_asset_content)

    # Process the job - should fail because asset cannot be found
    result = process_one_job(store, worker_id="test_worker", lease_seconds=60)
    assert result.processed
    assert result.job is not None
    assert result.job.status == JobStatus.FAILED
    assert result.job.failure is not None
    assert result.job.failure.code == "transform_asset_not_found"
    assert "asset" in result.job.failure.message.lower()
    # No candidate should be created for a failed job
    assert result.job.candidate_id is None


def test_worker_fails_job_when_asset_not_found(
    store: SQLiteJobStore,
) -> None:
    """Verify that when a source asset is not found, the job is marked as
    failed with a specific error code, not silently completed as succeeded."""

    # Create a mask (without the corresponding asset)
    mask_request = CreateMaskRequest(
        mask_id="mask_orphan_test",
        source_asset_id="asset_nonexistent",
        width_px=2,
        height_px=2,
        editable_mask_b64=base64.b64encode(bytes([1, 1, 1, 1])).decode("utf-8"),
        protected_subregions=[],
        feather_band_px=0,
        human_corrected=False,
        revision=1,
    )
    store.create_mask(mask_request, request_id="test")

    # Create a job referencing a nonexistent source asset
    job_request = CreateVariantJobRequest(
        parent_product_id="product_test",
        source_asset_id="asset_nonexistent",
        mask_id="mask_orphan_test",
        target_colour="#1b4d3e",
        owner_id="test_owner",
    )
    job, _ = store.create_variant_job(
        job_request, idempotency_key="missing-asset-test", request_id="test"
    )

    # Process the job - should fail because asset is missing
    result = process_one_job(store, worker_id="test_worker", lease_seconds=60)
    assert result.processed
    assert result.job is not None
    assert result.job.status == JobStatus.FAILED
    assert result.job.failure is not None
    assert result.job.failure.code == "transform_asset_not_found"
    assert "asset" in result.job.failure.message.lower()
    # No candidate should be created for a failed job
    assert result.job.candidate_id is None


def test_worker_fails_job_when_invalid_colour(
    store: SQLiteJobStore,
) -> None:
    """Verify that when an invalid target colour is provided, the job is
    marked as failed with a specific error code."""

    # Create an asset and mask
    source_rgb = np.array(
        [
            [[240, 240, 240], [80, 80, 80]],
            [[70, 70, 70], [240, 240, 240]],
        ],
        dtype=np.uint8,
    )
    source_bytes = _png_bytes(source_rgb)
    asset_request = CreateAssetRequest(
        owner_id="test_owner",
        original_filename="source.png",
        media_type="image/png",
        content_bytes=source_bytes,
    )
    source_asset = store.create_asset(asset_request, request_id="test")
    source_asset_id = source_asset.asset_id

    editable_mask = bytes([0, 1, 1, 0])
    mask_request = CreateMaskRequest(
        mask_id="mask_colour_test",
        source_asset_id=source_asset_id,
        width_px=2,
        height_px=2,
        editable_mask_b64=base64.b64encode(editable_mask).decode("utf-8"),
        protected_subregions=[],
        feather_band_px=0,
        human_corrected=True,
        revision=1,
    )
    store.create_mask(mask_request, request_id="test")

    # Create a job with an invalid colour format
    job_request = CreateVariantJobRequest(
        parent_product_id="product_test",
        source_asset_id=source_asset_id,
        mask_id="mask_colour_test",
        target_colour="not_a_hex_colour",
        owner_id="test_owner",
    )
    job, _ = store.create_variant_job(
        job_request, idempotency_key="invalid-colour-test", request_id="test"
    )

    # Process the job - should fail because colour is invalid
    result = process_one_job(store, worker_id="test_worker", lease_seconds=60)
    assert result.processed
    assert result.job is not None
    assert result.job.status == JobStatus.FAILED
    assert result.job.failure is not None
    assert result.job.failure.code == "transform_invalid_colour"
    assert "colour" in result.job.failure.message.lower()
    # No candidate should be created for a failed job
    assert result.job.candidate_id is None
