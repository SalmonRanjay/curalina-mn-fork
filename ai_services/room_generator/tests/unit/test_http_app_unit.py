from __future__ import annotations

import os
import uuid
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from curalina_rooms.api import create_app
from curalina_rooms.api.fixtures import load_fixture
from curalina_rooms.api.service import RoomsContractService

_TEST_DATABASE_URL = os.environ.get(
    "CURALINA_TEST_DATABASE_URL",
    "postgresql://curalina:curalina_dev_password@localhost:5432/curalina_rooms_test",
)


def test_http_asset_routes() -> None:
    client = TestClient(create_app(RoomsContractService()))

    created = client.post(
        "/v1/assets",
        json=load_fixture("asset_import_request.json"),
    )

    assert created.status_code == 201
    asset_id = created.json()["asset_id"]

    content = client.get(f"/v1/assets/{asset_id}/content")
    assert content.status_code == 200
    assert content.json()["asset_id"] == asset_id


def test_http_render_job_lifecycle_routes() -> None:
    client = TestClient(create_app(RoomsContractService()))

    created = client.post(
        "/v1/render-jobs",
        json=load_fixture("render_job_request_valid.json"),
    )
    assert created.status_code == 202
    job_id = created.json()["job_id"]

    queued = client.get(f"/v1/jobs/{job_id}")
    assert queued.status_code == 200
    assert queued.json()["status"] == "queued"

    cancelled = client.post(f"/v1/jobs/{job_id}/cancel")
    assert cancelled.status_code == 200
    assert cancelled.json()["status"] == "cancelled"


def test_http_candidate_review_and_error_routes() -> None:
    client = TestClient(create_app(RoomsContractService()))

    review = client.post(
        "/v1/candidates/cand_render000001/reviews",
        json=load_fixture("candidate_review_request.json"),
    )
    assert review.status_code == 201
    assert review.json()["decision"] == "approved"

    missing = client.get(
        "/v1/jobs/job_missing",
        headers={"X-Request-ID": "req-room-unit-missing"},
    )
    assert missing.status_code == 404
    assert missing.json()["request_id"] == "req-room-unit-missing"


def test_http_default_app_uses_postgres_store(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    monkeypatch.setenv("CURALINA_DATABASE_URL", _TEST_DATABASE_URL)
    monkeypatch.setenv(
        "CURALINA_DATABASE_SCHEMA", f"test_{uuid.uuid4().hex[:16]}"
    )
    monkeypatch.setenv("CURALINA_DATA_DIR", str(tmp_path))
    client = TestClient(create_app())

    created = client.post(
        "/v1/render-jobs",
        json=load_fixture("render_job_request_valid.json"),
    )

    assert created.status_code == 202
    assert created.json()["job_id"] == "job_000001"
