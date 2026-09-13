"""A1 contract tests for the recommendation `/v1` HTTP surface.

Per `agentic_flow/recommendation_workflow.md`'s A1 done-evidence: contract
tests pass; an unsupported major `schema_version` returns 422; a request
missing a required field is rejected with a structured error, not a 500.
Per `architecture/guides/08_engineering_and_tests.md`: contract tests use a
real in-process HTTP client (`fastapi.testclient.TestClient`, backed by
Starlette/httpx) against the real app object -- no mocked transport, no
mocked FastAPI dependency wiring -- with fake application logic behind it
(fixture-backed handlers, no ranking).
"""

from __future__ import annotations

from typing import Any

import pytest
from fastapi.testclient import TestClient

from curalina_recommendation.api import create_app

ERROR_REQUIRED_FIELDS = {"code", "message", "details", "retryable", "request_id"}


@pytest.fixture()
def client() -> TestClient:
    return TestClient(create_app())


def _assert_structured_error(
    body: dict[str, Any], *, expected_code: str | None = None
) -> None:
    assert ERROR_REQUIRED_FIELDS <= body.keys()
    assert isinstance(body["code"], str) and body["code"]
    assert isinstance(body["message"], str) and body["message"]
    assert isinstance(body["details"], dict)
    assert isinstance(body["retryable"], bool)
    assert isinstance(body["request_id"], str) and body["request_id"]
    if expected_code is not None:
        assert body["code"] == expected_code


# --- POST /v1/catalogue/imports ------------------------------------------


def test_catalogue_import_success(client: TestClient) -> None:
    response = client.post(
        "/v1/catalogue/imports",
        json={
            "schema_version": "1.0",
            "source_uri": "file://data/raw/artwork_catalogue.xlsx",
            "supplier_id": "supplier_curated_001",
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["schema_version"] == "1.0"
    assert body["snapshot_id"].startswith("snap_")
    assert body["report"]["products_seen"] >= body["report"]["products_imported"]


def test_catalogue_import_missing_required_field_is_structured_422(
    client: TestClient,
) -> None:
    response = client.post(
        "/v1/catalogue/imports",
        json={"schema_version": "1.0", "source_uri": "file://data/raw/x.xlsx"},
    )

    assert response.status_code == 422
    _assert_structured_error(response.json(), expected_code="invalid_request")


def test_catalogue_import_unsupported_major_version_is_422(client: TestClient) -> None:
    response = client.post(
        "/v1/catalogue/imports",
        json={
            "schema_version": "2.0",
            "source_uri": "file://data/raw/artwork_catalogue.xlsx",
            "supplier_id": "supplier_curated_001",
        },
    )

    assert response.status_code == 422
    _assert_structured_error(
        response.json(), expected_code="unsupported_schema_version"
    )


# --- POST /v1/recommendations ---------------------------------------------


def _valid_profile() -> dict[str, Any]:
    return {
        "room_type": "living_room",
        "style": "organic_modern",
        "atmosphere": "warm_balanced",
        "categories": ["sofa", "wall_art"],
        "furniture_budget_minor_units": 400000,
        "currency": "CAD",
    }


def test_recommendations_success(client: TestClient) -> None:
    response = client.post(
        "/v1/recommendations",
        json={
            "schema_version": "1.0",
            "catalogue_snapshot_id": "snap_a1fixture0001",
            "profile": _valid_profile(),
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["catalogue_snapshot_id"] == "snap_a1fixture0001"
    assert len(body["candidates"]) > 0
    for candidate in body["candidates"]:
        assert 0.0 <= candidate["score"] <= 1.0
        assert candidate["reasons"]


def test_recommendations_missing_required_field_is_structured_422(
    client: TestClient,
) -> None:
    profile = _valid_profile()
    del profile["furniture_budget_minor_units"]

    response = client.post(
        "/v1/recommendations",
        json={
            "schema_version": "1.0",
            "catalogue_snapshot_id": "snap_a1fixture0001",
            "profile": profile,
        },
    )

    assert response.status_code == 422
    _assert_structured_error(response.json(), expected_code="invalid_request")


def test_recommendations_unsupported_major_version_is_422(client: TestClient) -> None:
    response = client.post(
        "/v1/recommendations",
        json={
            "schema_version": "9.9",
            "catalogue_snapshot_id": "snap_a1fixture0001",
            "profile": _valid_profile(),
        },
    )

    assert response.status_code == 422
    _assert_structured_error(
        response.json(), expected_code="unsupported_schema_version"
    )


# --- POST /v1/bundles -------------------------------------------------------


def test_bundles_success_feasible(client: TestClient) -> None:
    response = client.post(
        "/v1/bundles",
        json={
            "schema_version": "1.0",
            "catalogue_snapshot_id": "snap_a1fixture0001",
            "rules_version": "rules_2024_01",
            "profile": _valid_profile(),
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["feasible"] is True
    assert len(body["line_items"]) > 0
    assert body["violations"] == []


def test_bundles_no_solution_is_feasible_false_with_200(client: TestClient) -> None:
    profile = _valid_profile()
    profile["furniture_budget_minor_units"] = 1  # below the fixture's feasibility floor

    response = client.post(
        "/v1/bundles",
        json={
            "schema_version": "1.0",
            "catalogue_snapshot_id": "snap_a1fixture0001",
            "rules_version": "rules_2024_01",
            "profile": profile,
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["feasible"] is False
    assert body["line_items"] == []
    assert len(body["violations"]) > 0


def test_bundles_missing_required_field_is_structured_422(client: TestClient) -> None:
    response = client.post(
        "/v1/bundles",
        json={
            "schema_version": "1.0",
            "catalogue_snapshot_id": "snap_a1fixture0001",
            "profile": _valid_profile(),
        },
    )

    assert response.status_code == 422
    _assert_structured_error(response.json(), expected_code="invalid_request")


def test_bundles_unsupported_major_version_is_422(client: TestClient) -> None:
    response = client.post(
        "/v1/bundles",
        json={
            "schema_version": "0.9",
            "catalogue_snapshot_id": "snap_a1fixture0001",
            "rules_version": "rules_2024_01",
            "profile": _valid_profile(),
        },
    )

    assert response.status_code == 422
    _assert_structured_error(
        response.json(), expected_code="unsupported_schema_version"
    )


# --- POST /v1/bundles/{bundle_id}/substitutions -----------------------------


def test_substitutions_success(client: TestClient) -> None:
    response = client.post(
        "/v1/bundles/rev_a1fixture0001/substitutions",
        json={
            "schema_version": "1.0",
            "replace_product_id": "prod_sofa_0001",
            "reason": "customer_requested_lower_price",
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["original_bundle_id"] == "rev_a1fixture0001"
    assert body["new_bundle_id"] != body["original_bundle_id"]
    assert body["revision"] > 1


def test_substitutions_missing_required_field_is_structured_422(
    client: TestClient,
) -> None:
    response = client.post(
        "/v1/bundles/rev_a1fixture0001/substitutions",
        json={"schema_version": "1.0"},
    )

    assert response.status_code == 422
    _assert_structured_error(response.json(), expected_code="invalid_request")


def test_substitutions_unsupported_major_version_is_422(client: TestClient) -> None:
    response = client.post(
        "/v1/bundles/rev_a1fixture0001/substitutions",
        json={
            "schema_version": "3.0",
            "replace_product_id": "prod_sofa_0001",
        },
    )

    assert response.status_code == 422
    _assert_structured_error(
        response.json(), expected_code="unsupported_schema_version"
    )


# --- Shared error vocabulary matches ai_services/contracts/v1 ---------------


def test_error_body_matches_shared_error_schema_fields(client: TestClient) -> None:
    response = client.post("/v1/recommendations", json={"schema_version": "1.0"})

    assert response.status_code == 422
    assert set(response.json().keys()) == ERROR_REQUIRED_FIELDS
