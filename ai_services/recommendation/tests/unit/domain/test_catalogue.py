"""Named test: duplicate keys."""

from __future__ import annotations

import pytest

from curalina_recommendation.domain.catalogue import (
    CatalogueImportReport,
    CatalogueSnapshot,
)
from curalina_recommendation.domain.eligibility import Availability
from curalina_recommendation.domain.errors import DuplicateProductKeyError
from curalina_recommendation.domain.product import Product, ProductKey

_REPORT = CatalogueImportReport(
    products_seen=2, products_imported=2, products_rejected=0
)


def _unknown_product(product_id: str, *, supplier_id: str, sku: str) -> Product:
    return Product(
        product_id=product_id,
        key=ProductKey.build(supplier_id=supplier_id, raw_sku=sku),
        category="wall_art",
        name=product_id,
        availability=Availability.UNKNOWN,
    )


def test_duplicate_compound_key_is_rejected() -> None:
    duplicate_a = _unknown_product("prod-1", supplier_id="sup-1", sku="ART-001")
    duplicate_b = _unknown_product("prod-2", supplier_id="sup-1", sku="ART-001")

    with pytest.raises(DuplicateProductKeyError) as excinfo:
        CatalogueSnapshot(
            snapshot_id="snap-1",
            supplier_id="sup-1",
            products=(duplicate_a, duplicate_b),
            report=_REPORT,
        )

    assert excinfo.value.supplier_id == "sup-1"
    assert excinfo.value.normalized_sku == "ART-001"


def test_duplicate_key_detection_uses_normalized_sku() -> None:
    # Different raw whitespace, same normalized identity -> still a duplicate.
    duplicate_a = _unknown_product("prod-1", supplier_id="sup-1", sku="ART-001")
    duplicate_b = _unknown_product("prod-2", supplier_id="sup-1", sku="  ART-001  ")

    with pytest.raises(DuplicateProductKeyError):
        CatalogueSnapshot(
            snapshot_id="snap-1",
            supplier_id="sup-1",
            products=(duplicate_a, duplicate_b),
            report=_REPORT,
        )


def test_different_supplier_same_sku_is_not_a_duplicate() -> None:
    product_a = _unknown_product("prod-1", supplier_id="sup-1", sku="ART-001")
    product_b = _unknown_product("prod-2", supplier_id="sup-2", sku="ART-001")

    snapshot = CatalogueSnapshot(
        snapshot_id="snap-1",
        supplier_id="sup-1",
        products=(product_a, product_b),
        report=_REPORT,
    )

    assert len(snapshot.products) == 2


def test_import_report_rejects_counts_exceeding_seen() -> None:
    with pytest.raises(ValueError):
        CatalogueImportReport(
            products_seen=1, products_imported=1, products_rejected=1
        )
