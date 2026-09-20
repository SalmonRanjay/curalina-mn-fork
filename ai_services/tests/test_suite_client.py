from __future__ import annotations

import hashlib
from pathlib import Path
from typing import Any

import pytest

import suite_client


def test_dry_run_names_ready_and_deferred_services(
    capsys: pytest.CaptureFixture[str],
) -> None:
    assert suite_client.dry_run() == 0

    output = capsys.readouterr().out
    assert "recommendation" in output
    assert "variants" in output
    assert "rooms" in output


def test_port_check_names_occupied_service(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(suite_client, "_port_is_open", lambda port: port == 8101)

    with pytest.raises(suite_client.SuiteError, match="recommendation port 8101"):
        suite_client._assert_port_free(suite_client.SERVICE_SPECS["recommendation"])


def test_require_field_names_service_endpoint_and_field() -> None:
    with pytest.raises(
        suite_client.SuiteError,
        match="variants /v1/jobs/job_000001 missing response field: candidate_id",
    ):
        suite_client._require_field(
            "variants", "/v1/jobs/job_000001", {"job_id": "job_000001"}, "candidate_id"
        )


def test_variants_flow_verifies_hash_and_review_roundtrip(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    calls: list[tuple[str, str, dict[str, Any] | None]] = []

    def fake_json_request(
        method: str,
        url: str,
        *,
        payload: dict[str, Any] | None = None,
        headers: dict[str, str] | None = None,
    ) -> dict[str, Any]:
        del headers
        calls.append((method, url, payload))
        if url.endswith("/v1/assets"):
            assert payload is not None
            content = str(payload["content_bytes"]).encode("ascii")
            return {
                "schema_version": "1.0",
                "asset_id": "asset_000001",
                "content_hash": (
                    "sha256:" + hashlib.sha256(content).hexdigest()
                ),
                "media_type": "image/png",
                "width_px": 1,
                "height_px": 1,
                "owner_id": "suite_user",
                "provenance": "upload",
                "original_filename": "suite-product.png",
                "created_at": "2026-09-14T00:00:00Z",
            }
        if url.endswith("/v1/jobs") and method == "POST":
            assert payload is not None
            assert payload["source_asset_id"] == "asset_000001"
            assert payload["parent_product_id"] == "prod_sofa_0001"
            return {
                "schema_version": "1.0",
                "job_id": "job_000001",
                "status": "queued",
                "owner_id": "suite_user",
                "idempotency_key": "suite-variant-job-1",
                "request_hash": "hash",
                "attempt_count": 0,
                "created_at": "2026-09-14T00:00:00Z",
                "updated_at": "2026-09-14T00:00:00Z",
                "candidate_id": None,
                "failure": None,
            }
        if url.endswith("/v1/jobs/job_000001") and method == "GET":
            return {
                "schema_version": "1.0",
                "job_id": "job_000001",
                "status": "succeeded",
                "owner_id": "suite_user",
                "idempotency_key": "suite-variant-job-1",
                "request_hash": "hash",
                "attempt_count": 1,
                "created_at": "2026-09-14T00:00:00Z",
                "updated_at": "2026-09-14T00:00:00Z",
                "candidate_id": "cand_000001",
                "failure": None,
            }
        if url.endswith("/v1/candidates/cand_000001/reviews"):
            assert payload == {
                "schema_version": "1.0",
                "reviewer_id": "suite_reviewer",
                "decision": "approved",
                "expected_revision": 1,
            }
            return {
                "schema_version": "1.0",
                "review_id": "review_000001",
                "candidate_id": "cand_000001",
                "reviewer_id": "suite_reviewer",
                "decision": "approved",
                "revision": 2,
                "created_at": "2026-09-14T00:00:00Z",
            }
        raise AssertionError(f"unexpected request: {method} {url}")

    worker_calls: list[Path] = []
    monkeypatch.setattr(suite_client, "_json_request", fake_json_request)
    monkeypatch.setattr(
        suite_client,
        "_run_variant_worker",
        lambda data_dir: worker_calls.append(data_dir),
    )

    job_id, candidate_id = suite_client._variants_flow(
        "http://127.0.0.1:8102", tmp_path, product_id="prod_sofa_0001"
    )

    assert job_id == "job_000001"
    assert candidate_id == "cand_000001"
    assert worker_calls == [tmp_path]
    assert [call[1] for call in calls] == [
        "http://127.0.0.1:8102/v1/assets",
        "http://127.0.0.1:8102/v1/jobs",
        "http://127.0.0.1:8102/v1/jobs/job_000001",
        "http://127.0.0.1:8102/v1/candidates/cand_000001/reviews",
    ]


def test_port_check_allows_free_service(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(suite_client, "_port_is_open", lambda port: False)

    suite_client._assert_port_free(suite_client.SERVICE_SPECS["variants"])


def test_rooms_flow_verifies_hash_render_and_review_roundtrip(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    calls: list[tuple[str, str, dict[str, Any] | None]] = []

    def fake_json_request(
        method: str,
        url: str,
        *,
        payload: dict[str, Any] | None = None,
        headers: dict[str, str] | None = None,
    ) -> dict[str, Any]:
        del headers
        calls.append((method, url, payload))
        if url.endswith("/v1/assets") and method == "POST":
            assert payload is not None
            owner_id = str(payload["owner_id"])
            original_filename = str(payload["original_filename"])
            content_length = str(payload["content_length"])
            digest_source = f"{owner_id}|{original_filename}|{content_length}|".encode()
            content_hash = (
                "sha256:" + hashlib.sha256(digest_source).hexdigest()
            )
            asset_id = (
                "asset_room000001"
                if "room" in original_filename
                else "asset_hero000001"
            )
            return {
                "schema_version": "1.0",
                "asset_id": asset_id,
                "owner_id": owner_id,
                "content_hash": content_hash,
                "media_type": payload["media_type"],
                "original_filename": original_filename,
                "provenance": payload["provenance"],
                "created_at": "2026-09-15T00:00:00Z",
            }
        if url.endswith("/v1/render-jobs") and method == "POST":
            assert payload is not None
            assert payload["bundle"] == {
                "bundle_id": "bundle_liv001",
                "bundle_revision": "rev_002",
            }
            assert payload["reference_images"] == [
                {"asset_id": "asset_room000001", "role": "room_photo"},
                {"asset_id": "asset_hero000001", "role": "hero_product"},
            ]
            return {
                "schema_version": "1.0",
                "job_id": "job_000001",
                "status": "queued",
                "location": "/v1/jobs/job_000001",
                "bundle_id": "bundle_liv001",
                "bundle_revision": "rev_002",
                "created_at": "2026-09-15T00:00:00Z",
            }
        if url.endswith("/v1/jobs/job_000001") and method == "GET":
            return {
                "schema_version": "1.0",
                "job_id": "job_000001",
                "status": "succeeded",
                "attempt_count": 1,
                "result": {
                    "candidate_id": "cand_000001",
                    "outcome_counts": {"insertions_staged": 1},
                },
                "error": None,
            }
        if url.endswith("/v1/candidates/cand_000001/reviews"):
            assert payload == {
                "schema_version": "1.0",
                "reviewer_id": "suite_reviewer",
                "decision": "approved",
                "expected_revision": 1,
            }
            return {
                "schema_version": "1.0",
                "review_id": "review_000001",
                "candidate_id": "cand_000001",
                "reviewer_id": "suite_reviewer",
                "decision": "approved",
                "revision": 2,
                "created_at": "2026-09-15T00:00:00Z",
            }
        raise AssertionError(f"unexpected request: {method} {url}")

    worker_calls: list[Path] = []
    monkeypatch.setattr(suite_client, "_json_request", fake_json_request)
    monkeypatch.setattr(
        suite_client,
        "_run_rooms_worker",
        lambda data_dir: worker_calls.append(data_dir),
    )

    job_id, candidate_id = suite_client._rooms_flow(
        "http://127.0.0.1:8103",
        tmp_path,
        product_id="prod_sofa_0001",
        variant_candidate_id="cand_000001",
    )

    assert job_id == "job_000001"
    assert candidate_id == "cand_000001"
    assert worker_calls == [tmp_path]
    assert [call[1] for call in calls] == [
        "http://127.0.0.1:8103/v1/assets",
        "http://127.0.0.1:8103/v1/assets",
        "http://127.0.0.1:8103/v1/render-jobs",
        "http://127.0.0.1:8103/v1/jobs/job_000001",
        "http://127.0.0.1:8103/v1/candidates/cand_000001/reviews",
    ]


def test_rooms_flow_names_field_on_content_hash_mismatch(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    def fake_json_request(
        method: str,
        url: str,
        *,
        payload: dict[str, Any] | None = None,
        headers: dict[str, str] | None = None,
    ) -> dict[str, Any]:
        del method, headers
        assert payload is not None
        return {
            "schema_version": "1.0",
            "asset_id": "asset_room000001",
            "owner_id": payload["owner_id"],
            "content_hash": "sha256:not-the-real-hash",
            "media_type": payload["media_type"],
            "original_filename": payload["original_filename"],
            "provenance": payload["provenance"],
            "created_at": "2026-09-15T00:00:00Z",
        }

    monkeypatch.setattr(suite_client, "_json_request", fake_json_request)

    with pytest.raises(
        suite_client.SuiteError, match=r"rooms /v1/assets field content_hash mismatch"
    ):
        suite_client._rooms_flow(
            "http://127.0.0.1:8103",
            tmp_path,
            product_id="prod_sofa_0001",
            variant_candidate_id="cand_000001",
        )


def test_dry_run_reports_no_deferred_services(
    capsys: pytest.CaptureFixture[str],
) -> None:
    assert suite_client.DEFERRED_SERVICES == ()
    assert suite_client.dry_run() == 0

    output = capsys.readouterr().out
    assert "deferred services: none" in output
