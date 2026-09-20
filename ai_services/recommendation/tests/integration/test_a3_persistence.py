from __future__ import annotations

import sqlite3
from dataclasses import replace
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient

from curalina_recommendation.adapters.xlsx_catalogue_importer import (
    XlsxCatalogueImporter,
)
from curalina_recommendation.api import create_app
from curalina_recommendation.api.application_services import (
    RecommendationApplicationServices,
    build_application_services,
)
from curalina_recommendation.api.repository import RecommendationRepository
from curalina_recommendation.application.catalogue_service import CatalogueService
from curalina_recommendation.domain.bundle import Bundle, BundleLineItem
from curalina_recommendation.domain.money import Money
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


def _bundle(*, bundle_id: str, rules_version: str) -> Bundle:
    return Bundle(
        bundle_id=bundle_id,
        revision=1,
        profile_snapshot_id="profile_integration",
        catalogue_snapshot_id="snap_a3fixture0001",
        rules_version=rules_version,
        currency="CAD",
        line_items=(
            BundleLineItem(
                product_id="prod_sofa_0001",
                category="sofa",
                quantity=1,
                unit_price=Money.from_minor_units(120000, "CAD"),
            ),
        ),
        feasible=True,
    )


def test_repository_rolls_back_all_statements_when_bundle_write_fails(
    tmp_path: Path,
) -> None:
    settings = _settings(tmp_path)
    repository = RecommendationRepository.from_database_url(
        settings.curalina_database_url
    )
    repository.initialize()
    with sqlite3.connect(repository.db_path) as connection:
        connection.execute(
            """
            CREATE TRIGGER fail_selected_bundle
            BEFORE INSERT ON bundles
            WHEN NEW.bundle_id = 'bundle_forced_failure'
            BEGIN
                SELECT RAISE(ABORT, 'deterministic integration failure');
            END
            """
        )

    with pytest.raises(sqlite3.IntegrityError, match="deterministic integration"):
        repository.save_bundle(
            _bundle(
                bundle_id="bundle_forced_failure",
                rules_version="rules_must_roll_back",
            )
        )

    reopened = RecommendationRepository.from_database_url(
        settings.curalina_database_url
    )
    reopened.initialize()
    assert "rules_must_roll_back" not in reopened.list_rule_versions()
    with sqlite3.connect(reopened.db_path) as connection:
        row = connection.execute(
            "SELECT bundle_id FROM bundles WHERE bundle_id = ?",
            ("bundle_forced_failure",),
        ).fetchone()
    assert row is None


def test_snapshot_bundle_rule_version_and_public_operation_survive_restart(
    tmp_path: Path,
) -> None:
    settings = _settings(tmp_path)
    first_services = build_application_services(settings)
    first_client = TestClient(create_app(first_services))
    created = first_client.post(
        "/v1/bundles",
        json={
            "schema_version": "1.0",
            "catalogue_snapshot_id": "snap_a3fixture0001",
            "rules_version": "rules_restart_integration",
            "profile": _profile(),
        },
    )
    assert created.status_code == 200
    created_body = created.json()
    bundle_id = created_body["bundle_id"]
    first_product_id = created_body["line_items"][0]["product_id"]

    second_services = build_application_services(settings)
    assert second_services.repository.get_products_for_snapshot(
        "snap_a3fixture0001"
    ) == first_services.repository.get_products_for_snapshot("snap_a3fixture0001")
    persisted_bundle = second_services.repository.get_bundle(bundle_id)
    assert persisted_bundle.bundle_id == bundle_id
    assert persisted_bundle.revision == 1
    assert persisted_bundle.rules_version == "rules_restart_integration"
    assert (
        "rules_restart_integration"
        in second_services.repository.list_rule_versions()
    )

    second_client = TestClient(create_app(second_services))
    substituted = second_client.post(
        f"/v1/bundles/{bundle_id}/substitutions",
        json={
            "schema_version": "1.0",
            "replace_product_id": first_product_id,
            "reason": "restart_integration_check",
        },
    )
    assert substituted.status_code == 200
    assert substituted.json()["revision"] == 2


def _services_with_real_importer(
    settings: Settings,
) -> RecommendationApplicationServices:
    services = build_application_services(settings)
    return replace(
        services,
        catalogue=CatalogueService(importer=XlsxCatalogueImporter()),
    )


def test_malformed_workbook_import_returns_structured_invalid_request(
    tmp_path: Path,
) -> None:
    malformed_workbook = tmp_path / "malformed.xlsx"
    malformed_workbook.write_bytes(b"this is not an xlsx archive")
    client = TestClient(
        create_app(_services_with_real_importer(_settings(tmp_path))),
        raise_server_exceptions=False,
    )
    database_path = tmp_path / "recommendation.sqlite3"
    with sqlite3.connect(database_path) as connection:
        snapshots_before = connection.execute(
            "SELECT COUNT(*) FROM catalogue_snapshots"
        ).fetchone()

    response = client.post(
        "/v1/catalogue/imports",
        json={
            "schema_version": "1.0",
            "source_uri": str(malformed_workbook),
            "supplier_id": "Synthetic Supplier",
        },
    )

    assert response.status_code == 422
    assert response.json() == {
        "code": "invalid_request",
        "message": "Catalogue source is not a valid XLSX workbook.",
        "details": {"field": "source_uri", "reason": "malformed_workbook"},
        "retryable": False,
        "request_id": response.json()["request_id"],
    }
    assert response.json()["request_id"]
    with sqlite3.connect(database_path) as connection:
        snapshots_after = connection.execute(
            "SELECT COUNT(*) FROM catalogue_snapshots"
        ).fetchone()
    assert snapshots_after == snapshots_before


def test_repository_failure_is_not_mapped_as_malformed_workbook(
    tmp_path: Path,
) -> None:
    services = build_application_services(_settings(tmp_path))
    with sqlite3.connect(services.repository.db_path) as connection:
        connection.execute("DROP TABLE catalogue_snapshots")
    client = TestClient(create_app(services), raise_server_exceptions=False)

    response = client.post(
        "/v1/catalogue/imports",
        json={
            "schema_version": "1.0",
            "source_uri": "unused-by-fixture-adapter.xlsx",
            "supplier_id": "supplier_curated_001",
        },
    )

    assert response.status_code == 500
    assert response.text == "Internal Server Error"
