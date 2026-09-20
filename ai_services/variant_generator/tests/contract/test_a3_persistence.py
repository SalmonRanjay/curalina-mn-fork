from __future__ import annotations

import base64
from io import BytesIO
from pathlib import Path

import numpy as np
from fastapi.testclient import TestClient
from PIL import Image

from curalina_variants.api import create_app
from curalina_variants.api.fixtures import load_fixture
from curalina_variants.api.schemas import CreateAssetRequest, CreateMaskRequest
from curalina_variants.api.sqlite_store import SQLiteJobStore
from curalina_variants.workers import process_one_job


def _png_bytes(rgb: np.ndarray) -> bytes:
    """Encode a numpy RGB array as PNG bytes."""
    output = BytesIO()
    Image.fromarray(rgb.astype(np.uint8), mode="RGB").save(output, format="PNG")
    return output.getvalue()


def _store(tmp_path: Path) -> SQLiteJobStore:
    store = SQLiteJobStore(tmp_path / "variants.sqlite3")
    store.initialize()
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
        store.create_asset(asset_request, request_id="fixture-setup")
    except Exception:
        # If asset already exists (e.g., in persistence tests that reuse the database),
        # that's fine
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
        store.create_mask(mask_request, request_id="fixture-setup")
    except Exception:
        # If mask already exists (e.g., in persistence tests that reuse the database),
        # that's fine - we're just ensuring it's there
        pass
    return store


def test_sqlite_job_survives_app_restart_and_worker_completion(
    tmp_path: Path,
) -> None:
    first_store = _store(tmp_path)
    first_client = TestClient(create_app(first_store))
    created = first_client.post(
        "/v1/jobs",
        json=load_fixture("create_variant_job_request"),
        headers={"Idempotency-Key": "idem-persisted"},
    )
    assert created.status_code == 202
    job_id = created.json()["job_id"]

    worker_store = _store(tmp_path)
    result = process_one_job(worker_store, worker_id="worker-a3", lease_seconds=60)
    assert result.processed is True

    second_store = _store(tmp_path)
    second_client = TestClient(create_app(second_store))
    fetched = second_client.get(f"/v1/jobs/{job_id}")

    assert fetched.status_code == 200
    assert fetched.json()["status"] == "succeeded"
    assert fetched.json()["candidate_id"] is not None
