from typing import Any

import httpx
import pytest
from fastapi.testclient import TestClient

from curalina_recommendation.api.consultation_routes import CatalogueNotConfiguredError
from curalina_recommendation.api.routes import create_app
from curalina_recommendation.consultation.catalogue import (
    Catalogue,
    CatalogueProduct,
    CatalogueReport,
)
from curalina_recommendation.consultation.model import TwoTowerScorer
from curalina_recommendation.consultation.recommender import ConsultationRecommender
from curalina_recommendation.settings import Settings

ANSWERS: dict[str, Any] = {
    "room_type": "Bedroom",
    "aesthetic": "Organic Modern",
    "materiality": "Organic Modern",
    "atmosphere": "Bright & Airy",
    "pattern_preference": "Just Solids",
    "practical_touches": [
        "Cozy, relaxing space for everyday comfort",
        "Storage to keep everything tidy",
    ],
    "bed_size": "King Size Bed",
    "investment": "$20,000-$30,000",
}


def _bed(pid: str, bed_size: str) -> CatalogueProduct:
    return CatalogueProduct(
        product_id=pid,
        supplier="Luxus",
        sku=None,
        name=f"Pomme Bed - {bed_size}",
        category="Bed",
        price=7905.0,
        rooms=("Bedroom",),
        styles=("Organic Modern",),
        atmospheres=("Bright & Airy",),
        touches=(
            "Cozy, relaxing space for everyday comfort",
            "Pet friendly and durable fabrics",
        ),
        seating=None,
        bed_size=bed_size,
        width_in=80.0,
        depth_in=90.0,
        height_in=50.0,
        overview=None,
    )


def _client() -> TestClient:
    catalogue = Catalogue(
        (_bed("Luxus:row462", "King Size Bed"), _bed("Luxus:row463", "Queen Size Bed")),
        CatalogueReport(fingerprint="c" * 64),
    )
    recommender = ConsultationRecommender(catalogue, TwoTowerScorer.load())
    return TestClient(create_app(Settings(), consultation_provider=lambda: recommender))


def _post(client: TestClient, answers: dict[str, Any]) -> httpx.Response:
    return client.post(
        "/v1/consultation/recommendations",
        json={"schema_version": "1.0", "answers": answers},
    )


def test_real_model_places_the_king_bed_for_a_king_answer() -> None:
    response = _post(_client(), ANSWERS)
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["currency"] == "CAD"
    bed = body["placements"][0]
    assert bed["slot_id"] == "bedroom_bed"
    assert bed["product"]["product_id"] == "Luxus:row462"
    assert bed["product"]["rule_match"] is True
    assert bed["line_total_minor_units"] == 790500
    assert body["budget_ceiling_minor_units"] == 3_000_000
    assert body["model"]["trained_run"] == "run_20260930T233410"
    assert body["products_scored"] == 2


def test_missing_answer_is_needs_input() -> None:
    response = _post(_client(), {**ANSWERS, "atmosphere": None})
    assert response.status_code == 200
    assert response.json()["status"] == "needs_input"
    assert "atmosphere: missing" in response.json()["problems"]


def test_unknown_enum_value_is_a_contract_error() -> None:
    response = _post(_client(), {**ANSWERS, "atmosphere": "Calm/Serene"})
    assert response.status_code == 422
    assert response.json()["code"] == "invalid_request"


def test_without_a_catalogue_the_endpoint_fails_closed() -> None:
    def not_configured() -> ConsultationRecommender:
        raise CatalogueNotConfiguredError("CURALINA_SUPPLIER_DATA_DIR is not set")

    client = TestClient(create_app(Settings(), consultation_provider=not_configured))
    response = _post(client, ANSWERS)
    assert response.status_code == 503
    assert response.json()["code"] == "catalogue_not_configured"


def test_default_settings_without_data_dir_fail_closed(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("CURALINA_SUPPLIER_DATA_DIR", raising=False)
    client = TestClient(create_app(Settings()))
    assert _post(client, ANSWERS).status_code == 503
