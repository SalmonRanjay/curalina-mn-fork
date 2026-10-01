from __future__ import annotations

import os
import uuid
from typing import Any

from fastapi.testclient import TestClient

from curalina_recommendation.api import create_app
from curalina_recommendation.api.application_services import build_application_services
from curalina_recommendation.settings import Settings

_TEST_DATABASE_URL = os.environ.get(
    "CURALINA_TEST_DATABASE_URL",
    "postgresql://curalina:curalina_dev_password@localhost:5432/"
    "curalina_recommendation_test",
)


def _settings() -> Settings:
    return Settings(
        CURALINA_DATABASE_URL=_TEST_DATABASE_URL,
        CURALINA_DATABASE_SCHEMA=f"test_{uuid.uuid4().hex[:16]}",
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


def test_bundle_and_substitution_survive_new_app_instance() -> None:
    settings = _settings()
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
