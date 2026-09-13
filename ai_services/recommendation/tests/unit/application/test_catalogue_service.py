"""Wiring test: `CatalogueService` orchestrates through the injected
`CatalogueImporter` port (today, `FakeCatalogueImporter`) without adding
any behaviour of its own.
"""

from __future__ import annotations

from curalina_recommendation.adapters.fake_catalogue_importer import (
    FakeCatalogueImporter,
)
from curalina_recommendation.application.catalogue_service import CatalogueService
from curalina_recommendation.domain.eligibility import Availability
from curalina_recommendation.domain.product import Product, ProductKey


def test_catalogue_service_delegates_to_importer_and_filters_by_supplier() -> None:
    matching = Product(
        product_id="prod-1",
        key=ProductKey.build(supplier_id="sup-1", raw_sku="ART-001"),
        category="wall_art",
        name="Sunset",
        availability=Availability.UNKNOWN,
    )
    other_supplier = Product(
        product_id="prod-2",
        key=ProductKey.build(supplier_id="sup-2", raw_sku="ART-002"),
        category="wall_art",
        name="Dusk",
        availability=Availability.UNKNOWN,
    )
    service = CatalogueService(
        importer=FakeCatalogueImporter(fixture_products=(matching, other_supplier))
    )

    snapshot = service.import_catalogue(
        source_uri="file:///fixture.csv", supplier_id="sup-1"
    )

    assert snapshot.supplier_id == "sup-1"
    assert [product.product_id for product in snapshot.products] == ["prod-1"]
    assert snapshot.report.products_seen == 2
    assert snapshot.report.products_imported == 1
    assert snapshot.report.products_rejected == 1


def test_catalogue_service_is_deterministic_across_calls() -> None:
    product = Product(
        product_id="prod-1",
        key=ProductKey.build(supplier_id="sup-1", raw_sku="ART-001"),
        category="wall_art",
        name="Sunset",
        availability=Availability.UNKNOWN,
    )
    service = CatalogueService(
        importer=FakeCatalogueImporter(fixture_products=(product,))
    )

    first = service.import_catalogue(source_uri="file:///a.csv", supplier_id="sup-1")
    second = service.import_catalogue(source_uri="file:///a.csv", supplier_id="sup-1")

    assert first.snapshot_id == second.snapshot_id
    assert first.products == second.products
