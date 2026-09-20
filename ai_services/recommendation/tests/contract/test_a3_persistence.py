from __future__ import annotations

from pathlib import Path
from typing import Any

from fastapi.testclient import TestClient

from curalina_recommendation.api import create_app
from curalina_recommendation.api.application_services import build_application_services
from curalina_recommendation.settings import Settings


def _settings(tmp_path: Path) -> Settings:
    return Settings(
        CURALINA_DATABASE_URL=f"sqlite:///{tmp_path / 'recommendation.sqlite3'}"
    )


def _profile() -> dict[str, Any]:
    return {
        "room_type": "living_room",
        "style": "organic_modern",
        "atmosphere": "warm_balanced",
        "categories": ["sofa"],
        "furniture_budget_minor_units": 200000,
        "currency": "CAD",
    }


def test_bundle_and_substitution_survive_new_app_instance(tmp_path: Path) -> None:
    settings = _settings(tmp_path)
    first_client = TestClient(create_app(build_application_services(settings)))
    created = first_client.post(
        "/v1/bundles",
        json={
            "schema_version": "1.0",
            "catalogue_snapshot_id": "snap_a3fixture0001",
            "rules_version": "rules_persisted",
            "profile": _profile(),
        },
    )
    assert created.status_code == 200
    created_body = created.json()
    bundle_id = created_body["bundle_id"]
    first_product_id = created_body["line_items"][0]["product_id"]

    first_substitution = first_client.post(
        f"/v1/bundles/{bundle_id}/substitutions",
        json={
            "schema_version": "1.0",
            "replace_product_id": first_product_id,
            "reason": "customer_requested_lower_price",
        },
    )
    assert first_substitution.status_code == 200
    assert first_substitution.json()["revision"] == 2
    second_product_id = first_substitution.json()["line_items"][0]["product_id"]

    second_client = TestClient(create_app(build_application_services(settings)))
    second_substitution = second_client.post(
        f"/v1/bundles/{bundle_id}/substitutions",
        json={
            "schema_version": "1.0",
            "replace_product_id": second_product_id,
            "reason": "customer_reverted_choice",
        },
    )

    assert second_substitution.status_code == 200
    assert second_substitution.json()["revision"] == 3
