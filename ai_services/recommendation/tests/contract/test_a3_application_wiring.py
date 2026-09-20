"""A3 tests proving recommendation routes call application services."""

from __future__ import annotations

from typing import Any

from fastapi.testclient import TestClient

from curalina_recommendation.api import create_app


def _profile(*, budget_minor_units: int) -> dict[str, Any]:
    return {
        "room_type": "living_room",
        "style": "organic_modern",
        "atmosphere": "warm_balanced",
        "categories": ["sofa", "wall_art"],
        "furniture_budget_minor_units": budget_minor_units,
        "currency": "CAD",
    }


def test_catalogue_import_filters_by_supplier_through_application_service() -> None:
    client = TestClient(create_app())

    response = client.post(
        "/v1/catalogue/imports",
        json={
            "schema_version": "1.0",
            "source_uri": "file://data/raw/synthetic.json",
            "supplier_id": "unknown_supplier",
        },
    )

    assert response.status_code == 200
    assert response.json()["report"] == {
        "products_seen": 4,
        "products_imported": 0,
        "products_rejected": 4,
        "rejected_reasons": ["supplier_id_mismatch"],
    }


def test_recommendations_apply_application_budget_filter() -> None:
    client = TestClient(create_app())

    response = client.post(
        "/v1/recommendations",
        json={
            "schema_version": "1.0",
            "catalogue_snapshot_id": "snap_a3fixture0001",
            "profile": _profile(budget_minor_units=50000),
        },
    )

    assert response.status_code == 200
    product_ids = {
        candidate["product_id"] for candidate in response.json()["candidates"]
    }
    assert "prod_wall_art_0001" in product_ids
    assert "prod_sofa_0001" not in product_ids
