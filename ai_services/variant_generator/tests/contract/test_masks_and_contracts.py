"""A3 HTTP adapter tests for the variant-generator `/v1` surface."""

from __future__ import annotations

import base64

from fastapi.testclient import TestClient

from curalina_variants.api import create_app
from curalina_variants.api.fixtures import load_fixture
from curalina_variants.api.store import FakeJobStore


def test_http_create_and_fetch_variant_job() -> None:
    store = FakeJobStore()
    client = TestClient(create_app(store))

    # First, ingest a mask (required before creating a job)
    mask_payload = load_fixture("create_mask_request")
    mask_resp = client.post(
        "/v1/masks",
        json=mask_payload,
        headers={"X-Request-ID": "req-mask-setup"},
    )
    assert mask_resp.status_code == 201

    # Now create a job with that mask
    job_payload = load_fixture("create_variant_job_request")
    job_payload["mask_id"] = mask_payload["mask_id"]

    created = client.post(
        "/v1/jobs",
        json=job_payload,
        headers={"Idempotency-Key": "idem-http-1", "X-Request-ID": "req-http-1"},
    )

    assert created.status_code == 202
    body = created.json()
    assert created.headers["location"] == f"/v1/jobs/{body['job_id']}"
    assert body["status"] == "queued"

    fetched = client.get(f"/v1/jobs/{body['job_id']}")
    assert fetched.status_code == 200
    assert fetched.json()["job_id"] == body["job_id"]


def test_http_variant_errors_use_shared_error_body() -> None:
    client = TestClient(create_app(FakeJobStore()))

    response = client.get(
        "/v1/jobs/job_missing",
        headers={"X-Request-ID": "req-http-missing"},
    )

    assert response.status_code == 404
    assert response.json() == {
        "code": "not_found",
        "message": "Unknown job: 'job_missing'",
        "details": {"resource": "job", "resource_id": "job_missing"},
        "retryable": False,
        "request_id": "req-http-missing",
    }


def test_http_create_and_fetch_mask() -> None:
    """Test mask ingestion via POST /v1/masks and retrieval via GET."""
    store = FakeJobStore()
    client = TestClient(create_app(store))

    # Create a mask
    created = client.post(
        "/v1/masks",
        json=load_fixture("create_mask_request"),
        headers={"X-Request-ID": "req-mask-1"},
    )

    assert created.status_code == 201
    body = created.json()
    assert body["mask_id"] == "mask_000001"
    assert body["source_asset_id"] == "asset_000001"
    assert body["width_px"] == 2
    assert body["height_px"] == 2
    assert body["editable_mask_b64"] == "AQEBAQ=="
    assert body["feather_band_px"] == 3
    assert body["revision"] == 1

    # Retrieve the mask
    fetched = client.get(
        f"/v1/masks/{body['mask_id']}", headers={"X-Request-ID": "req-mask-fetch"}
    )
    assert fetched.status_code == 200
    fetched_body = fetched.json()
    assert fetched_body["mask_id"] == body["mask_id"]
    assert fetched_body["editable_mask_b64"] == body["editable_mask_b64"]


def test_http_get_nonexistent_mask_returns_404() -> None:
    """Test that GET /v1/masks/{id} returns 404 for unknown mask."""
    client = TestClient(create_app(FakeJobStore()))

    response = client.get(
        "/v1/masks/mask_missing", headers={"X-Request-ID": "req-mask-404"}
    )

    assert response.status_code == 404
    assert response.json() == {
        "code": "not_found",
        "message": "Unknown mask: 'mask_missing'",
        "details": {"resource": "mask", "resource_id": "mask_missing"},
        "retryable": False,
        "request_id": "req-mask-404",
    }


def test_http_create_mask_with_invalid_base64_returns_422() -> None:
    """Test that invalid base64 in editable_mask_b64 is rejected with 422."""
    store = FakeJobStore()
    client = TestClient(create_app(store))

    payload = load_fixture("create_mask_request")
    payload["editable_mask_b64"] = "not-valid-base64!!!"

    response = client.post(
        "/v1/masks", json=payload, headers={"X-Request-ID": "req-mask-invalid"}
    )

    assert response.status_code == 422
    body = response.json()
    assert body["code"] == "validation_error"
    assert "validation" in body["message"].lower()


def test_http_create_mask_with_wrong_size_returns_422() -> None:
    """Test that mask bytes not matching width*height is rejected with 422."""
    store = FakeJobStore()
    client = TestClient(create_app(store))

    payload = load_fixture("create_mask_request")
    # 2x2 mask should be 4 bytes, but we provide only 2 bytes
    payload["editable_mask_b64"] = base64.b64encode(bytes([1, 1])).decode("utf-8")

    response = client.post(
        "/v1/masks", json=payload, headers={"X-Request-ID": "req-mask-size"}
    )

    assert response.status_code == 422
    body = response.json()
    assert body["code"] == "validation_error"
    assert "bytes" in body["message"].lower()


def test_http_create_job_with_missing_mask_returns_404() -> None:
    """Test that POST /v1/jobs fails with 404 when mask_id does not exist."""
    store = FakeJobStore()
    client = TestClient(create_app(store))

    payload = load_fixture("create_variant_job_request")
    # Use a mask_id that has not been ingested
    payload["mask_id"] = "mask_nonexistent"

    response = client.post(
        "/v1/jobs",
        json=payload,
        headers={"Idempotency-Key": "idem-no-mask", "X-Request-ID": "req-no-mask"},
    )

    assert response.status_code == 404
    body = response.json()
    assert body["code"] == "not_found"
    assert "mask" in body["message"].lower()
    assert body["details"]["resource"] == "mask"
    assert body["details"]["resource_id"] == "mask_nonexistent"


def test_http_create_job_succeeds_when_mask_exists() -> None:
    """Test that POST /v1/jobs succeeds when mask_id is valid and ingested."""
    store = FakeJobStore()
    client = TestClient(create_app(store))

    # First, create a mask
    mask_payload = load_fixture("create_mask_request")
    mask_resp = client.post(
        "/v1/masks",
        json=mask_payload,
        headers={"X-Request-ID": "req-mask-pre"},
    )
    assert mask_resp.status_code == 201

    # Now create a job with that mask
    job_payload = load_fixture("create_variant_job_request")
    job_payload["mask_id"] = mask_payload["mask_id"]

    job_resp = client.post(
        "/v1/jobs",
        json=job_payload,
        headers={"Idempotency-Key": "idem-with-mask", "X-Request-ID": "req-with-mask"},
    )

    assert job_resp.status_code == 202
    assert job_resp.json()["status"] == "queued"
