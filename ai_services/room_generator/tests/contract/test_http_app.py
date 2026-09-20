"""A3 HTTP adapter tests for the room-generator `/v1` surface."""

from __future__ import annotations

from fastapi.testclient import TestClient

from curalina_rooms.api import create_app
from curalina_rooms.api.fixtures import load_fixture
from curalina_rooms.api.service import RoomsContractService


def test_http_create_get_and_cancel_render_job() -> None:
    client = TestClient(create_app(RoomsContractService()))

    created = client.post(
        "/v1/render-jobs",
        json=load_fixture("render_job_request_valid.json"),
        headers={"X-Request-ID": "req-room-http-1"},
    )

    assert created.status_code == 202
    body = created.json()
    assert created.headers["location"] == body["location"]
    assert body["status"] == "queued"

    fetched = client.get(f"/v1/jobs/{body['job_id']}")
    assert fetched.status_code == 200
    assert fetched.json()["status"] == "queued"

    cancelled = client.post(f"/v1/jobs/{body['job_id']}/cancel")
    assert cancelled.status_code == 200
    assert cancelled.json()["status"] == "cancelled"


def test_http_room_errors_use_shared_error_body() -> None:
    client = TestClient(create_app(RoomsContractService()))

    response = client.get(
        "/v1/jobs/job_missing",
        headers={"X-Request-ID": "req-room-missing"},
    )

    assert response.status_code == 404
    assert response.json() == {
        "code": "resource_not_found",
        "message": "job 'job_missing' was not found.",
        "details": {"resource_type": "job", "resource_id": "job_missing"},
        "retryable": False,
        "request_id": "req-room-missing",
    }
