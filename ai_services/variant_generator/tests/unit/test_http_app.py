from __future__ import annotations

from fastapi.testclient import TestClient

from curalina_variants.api import create_app
from curalina_variants.api.fixtures import load_fixture
from curalina_variants.api.store import FakeJobStore


def test_http_asset_upload_and_content_round_trip() -> None:
    store = FakeJobStore()
    client = TestClient(create_app(store))

    created = client.post(
        "/v1/assets",
        json={
            "schema_version": "1.0",
            "owner_id": "owner-http",
            "original_filename": "sample.png",
            "media_type": "image/png",
            "content_bytes": "image-bytes",
        },
    )

    assert created.status_code == 201
    asset_id = created.json()["asset_id"]

    content = client.get(f"/v1/assets/{asset_id}/content")
    assert content.status_code == 200
    assert content.content == b"image-bytes"
    assert content.headers["content-type"] == "image/png"


def test_http_job_lifecycle_and_review_routes() -> None:
    store = FakeJobStore()
    client = TestClient(create_app(store))

    # First, ingest a mask (required before creating a job)
    mask_payload = load_fixture("create_mask_request")
    mask_resp = client.post(
        "/v1/masks",
        json=mask_payload,
        headers={"X-Request-ID": "req-mask-unit"},
    )
    assert mask_resp.status_code == 201

    # Now create a job with that mask
    job_payload = load_fixture("create_variant_job_request")
    job_payload["mask_id"] = mask_payload["mask_id"]

    created = client.post(
        "/v1/jobs",
        json=job_payload,
        headers={"Idempotency-Key": "idem-unit"},
    )
    assert created.status_code == 202
    job_id = created.json()["job_id"]

    queued = client.get(f"/v1/jobs/{job_id}")
    assert queued.status_code == 200
    assert queued.json()["status"] == "queued"

    store.run_fake_job(job_id)
    succeeded = client.get(f"/v1/jobs/{job_id}")
    candidate_id = succeeded.json()["candidate_id"]
    review = client.post(
        f"/v1/candidates/{candidate_id}/reviews",
        json=load_fixture("create_review_request"),
    )
    assert review.status_code == 201
    assert review.json()["decision"] == "approved"


def test_http_cancel_and_error_routes() -> None:
    store = FakeJobStore()
    client = TestClient(create_app(store))

    # First, ingest a mask (required before creating a job)
    mask_payload = load_fixture("create_mask_request")
    mask_resp = client.post(
        "/v1/masks",
        json=mask_payload,
        headers={"X-Request-ID": "req-mask-cancel"},
    )
    assert mask_resp.status_code == 201

    # Now create a job with that mask
    job_payload = load_fixture("create_variant_job_request")
    job_payload["mask_id"] = mask_payload["mask_id"]

    created = client.post(
        "/v1/jobs",
        json=job_payload,
        headers={"Idempotency-Key": "idem-cancel-http"},
    )

    cancelled = client.post(f"/v1/jobs/{created.json()['job_id']}/cancel")
    assert cancelled.status_code == 200
    assert cancelled.json()["status"] == "cancelled"

    missing = client.get(
        "/v1/jobs/job_missing",
        headers={"X-Request-ID": "req-missing-http"},
    )
    assert missing.status_code == 404
    assert missing.json()["request_id"] == "req-missing-http"
