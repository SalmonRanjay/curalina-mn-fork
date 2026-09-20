from __future__ import annotations

from decimal import Decimal

import pytest

from curalina_recommendation.adapters.logic_only_bundle_composer import (
    SYNTHETIC_FIXTURE_LABEL,
    LogicOnlyBundleComposer,
)
from curalina_recommendation.domain.dimensions import Dimensions
from curalina_recommendation.domain.eligibility import Availability
from curalina_recommendation.domain.money import Money
from curalina_recommendation.domain.product import Product, ProductKey
from curalina_recommendation.domain.profile import Profile

_DIMENSIONS = Dimensions.from_inches(
    width_in=Decimal("36"), height_in=Decimal("30"), depth_in=Decimal("24")
)


def _product(
    product_id: str,
    *,
    category: str,
    price_minor_units: int,
    fixture_label: str | None = SYNTHETIC_FIXTURE_LABEL,
) -> Product:
    return Product(
        product_id=product_id,
        key=ProductKey.build(supplier_id="synthetic", raw_sku=product_id),
        category=category,
        name=product_id,
        availability=Availability.AVAILABLE,
        price=Money.from_minor_units(price_minor_units, "CAD"),
        dimensions=_DIMENSIONS,
        fixture_label=fixture_label,
    )


def _profile(*, categories: tuple[str, ...] = ("sofa", "lamp")) -> Profile:
    return Profile(
        profile_id="profile-logic",
        room_type="living_room",
        style="organic_modern",
        atmosphere="warm_balanced",
        categories=categories,
        budget=Money.from_minor_units(250000, "CAD"),
    )


def test_logic_only_composer_is_deterministic_and_respects_budget() -> None:
    composer = LogicOnlyBundleComposer()
    products = (
        _product("prod_sofa_expensive", category="sofa", price_minor_units=150000),
        _product("prod_sofa_cheap", category="sofa", price_minor_units=120000),
        _product("prod_lamp_cheap", category="lamp", price_minor_units=30000),
    )

    bundle = composer.compose(
        products=reversed(products),
        profile=_profile(),
        catalogue_snapshot_id="snap_synthetic",
        rules_version="rules_test",
    )

    assert [item.product_id for item in bundle.line_items] == [
        "prod_sofa_cheap",
        "prod_lamp_cheap",
    ]
    assert bundle.total == Money.from_minor_units(150000, "CAD")
    assert bundle.feasible is False
    assert set(bundle.violations) >= {
        "needs_input:style_proportion:OQ-002",
        "needs_input:material_rules:OQ-004",
        "needs_input:anchor_hex_library:OQ-007",
        "needs_input:catalogue_attributes:OQ-009",
        "needs_input:furniture_catalogue:OQ-011",
    }
    assert bundle.warnings == (
        "r03_no_go_real_data_logic_only_labelled_synthetic_fixtures",
    )


def test_unlabelled_fixture_cannot_be_silently_treated_as_real_evidence() -> None:
    bundle = LogicOnlyBundleComposer().compose(
        products=(
            _product(
                "prod_sofa_realish",
                category="sofa",
                price_minor_units=100000,
                fixture_label=None,
            ),
        ),
        profile=_profile(categories=("sofa",)),
        catalogue_snapshot_id="snap_unlabelled",
        rules_version="rules_test",
    )

    assert bundle.feasible is False
    assert "needs_input:real_catalogue_composition:OQ-011" in bundle.violations


def test_substitution_revalidates_and_bumps_revision() -> None:
    composer = LogicOnlyBundleComposer()
    original = composer.compose(
        products=(
            _product("prod_sofa_1", category="sofa", price_minor_units=100000),
        ),
        profile=_profile(categories=("sofa",)),
        catalogue_snapshot_id="snap_synthetic",
        rules_version="rules_test",
    )

    revised = composer.substitute(
        bundle=original,
        replace_product_id="prod_sofa_1",
        candidate=_product("prod_lamp_1", category="lamp", price_minor_units=50000),
    )

    assert revised.bundle_id == original.bundle_id
    assert revised.revision == 2
    assert revised.feasible is False
    assert any(
        violation.startswith("incompatible_pair:expected_category=sofa")
        for violation in revised.violations
    )
    assert "needs_input:style_proportion:OQ-002" in revised.violations


def test_substitution_requires_existing_line_item() -> None:
    bundle = LogicOnlyBundleComposer().compose(
        products=(
            _product("prod_sofa_1", category="sofa", price_minor_units=100000),
        ),
        profile=_profile(categories=("sofa",)),
        catalogue_snapshot_id="snap_synthetic",
        rules_version="rules_test",
    )

    with pytest.raises(ValueError, match="does not contain product"):
        LogicOnlyBundleComposer().substitute(
            bundle=bundle,
            replace_product_id="missing",
            candidate=_product(
                "prod_sofa_2", category="sofa", price_minor_units=90000
            ),
        )
