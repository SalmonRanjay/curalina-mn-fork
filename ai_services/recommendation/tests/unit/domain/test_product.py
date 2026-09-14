"""Named tests: whitespace SKU, missing required facts."""

from __future__ import annotations

from decimal import Decimal

import pytest

from curalina_recommendation.domain.dimensions import Dimensions
from curalina_recommendation.domain.eligibility import Availability
from curalina_recommendation.domain.errors import (
    InvalidSkuError,
    MissingRequiredFactError,
)
from curalina_recommendation.domain.money import Money
from curalina_recommendation.domain.product import Product, ProductKey

_DIMENSIONS = Dimensions.from_inches(width_in=Decimal("10"), height_in=Decimal("5"))
_PRICE = Money(Decimal("19.99"), "USD")


def test_whitespace_only_sku_is_rejected() -> None:
    with pytest.raises(InvalidSkuError):
        ProductKey.build(supplier_id="sup-1", raw_sku="   \t   ")


def test_sku_whitespace_is_normalized_but_original_retained() -> None:
    key = ProductKey.build(supplier_id="sup-1", raw_sku="  ART-001   Blue  ")
    assert key.normalized_sku == "ART-001 Blue"
    assert key.raw_sku == "  ART-001   Blue  "


def test_blank_supplier_id_is_rejected() -> None:
    with pytest.raises(ValueError):
        ProductKey.build(supplier_id="   ", raw_sku="ART-001")


def test_available_product_missing_price_raises_missing_required_fact() -> None:
    key = ProductKey.build(supplier_id="sup-1", raw_sku="ART-001")

    with pytest.raises(MissingRequiredFactError) as excinfo:
        Product(
            product_id="prod-1",
            key=key,
            category="wall_art",
            name="Sunset",
            availability=Availability.AVAILABLE,
            price=None,
            dimensions=_DIMENSIONS,
        )

    assert excinfo.value.missing_fact == "price"


def test_available_product_missing_dimensions_raises_missing_required_fact() -> None:
    key = ProductKey.build(supplier_id="sup-1", raw_sku="ART-001")

    with pytest.raises(MissingRequiredFactError) as excinfo:
        Product(
            product_id="prod-1",
            key=key,
            category="wall_art",
            name="Sunset",
            availability=Availability.AVAILABLE,
            price=_PRICE,
            dimensions=None,
        )

    assert excinfo.value.missing_fact == "dimensions"


def test_unknown_availability_permits_missing_price_and_dimensions() -> None:
    key = ProductKey.build(supplier_id="sup-1", raw_sku="ART-001")

    product = Product(
        product_id="prod-1",
        key=key,
        category="wall_art",
        name="Sunset",
        availability=Availability.UNKNOWN,
        price=None,
        dimensions=None,
    )

    assert product.availability is Availability.UNKNOWN
    assert product.price is None


def test_overview_defaults_to_none_and_accepts_prose() -> None:
    key = ProductKey.build(supplier_id="sup-1", raw_sku="ART-001")
    common = {
        "product_id": "prod-1",
        "key": key,
        "category": "side_table",
        "name": "Carrie Side Table Walnut",
        "availability": Availability.UNKNOWN,
    }

    assert Product(**common).overview is None
    assert (
        Product(**common, overview="Crafted from rich walnut.").overview
        == "Crafted from rich walnut."
    )


def test_blank_overview_is_rejected_rather_than_coerced() -> None:
    """ADR-0007: absence is `None`, never `""` — a blank string would read
    to an encoder as empty text rather than as a missing fact."""
    key = ProductKey.build(supplier_id="sup-1", raw_sku="ART-001")

    with pytest.raises(ValueError, match="overview must be None when absent"):
        Product(
            product_id="prod-1",
            key=key,
            category="side_table",
            name="Carrie Side Table Walnut",
            availability=Availability.UNKNOWN,
            overview="   ",
        )


def test_product_carries_no_label_source_fields() -> None:
    """ADR-0006 §D2 leakage firewall, asserted structurally: the fields the
    R02 relevance labels are derived from must not exist on `Product`, so
    no `FeatureEncoder` can reach them however it is written.
    """
    forbidden = {"room_type", "design_style", "tags", "style", "attributes"}

    assert forbidden.isdisjoint(set(Product.__dataclass_fields__))
