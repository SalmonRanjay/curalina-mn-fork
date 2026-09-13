"""Named test: quantity totals.

Also covers the exact-budget-boundary named test at the `Bundle.total`
level (a total exactly equal to budget is a legitimate feasible bundle,
not an off-by-one rejection).
"""

from __future__ import annotations

from decimal import Decimal

import pytest

from curalina_recommendation.domain.bundle import Bundle, BundleLineItem
from curalina_recommendation.domain.money import Money


def test_quantity_totals_multiply_unit_price_by_quantity() -> None:
    # "A chair quantity of two is intentional repetition"
    # (architecture/guides/03_data_contracts.md).
    chairs = BundleLineItem(
        product_id="chair-1",
        category="dining_chair",
        quantity=2,
        unit_price=Money(Decimal("120.00"), "USD"),
    )
    assert chairs.line_total == Money(Decimal("240.00"), "USD")


def test_bundle_total_sums_all_line_totals() -> None:
    line_items = (
        BundleLineItem(
            product_id="chair-1",
            category="dining_chair",
            quantity=2,
            unit_price=Money(Decimal("120.00"), "USD"),
        ),
        BundleLineItem(
            product_id="table-1",
            category="dining_table",
            quantity=1,
            unit_price=Money(Decimal("560.00"), "USD"),
        ),
    )
    bundle = Bundle(
        bundle_id="bundle-1",
        revision=1,
        profile_snapshot_id="profile-1",
        catalogue_snapshot_id="snap-1",
        rules_version="rules-1",
        currency="USD",
        line_items=line_items,
        feasible=True,
    )

    assert bundle.total == Money(Decimal("800.00"), "USD")
    assert bundle.total_quantity == 3


def test_bundle_total_at_exact_budget_boundary_is_feasible() -> None:
    budget = Money(Decimal("800.00"), "USD")
    line_items = (
        BundleLineItem(
            product_id="sofa-1",
            category="sofa",
            quantity=1,
            unit_price=Money(Decimal("800.00"), "USD"),
        ),
    )
    bundle = Bundle(
        bundle_id="bundle-1",
        revision=1,
        profile_snapshot_id="profile-1",
        catalogue_snapshot_id="snap-1",
        rules_version="rules-1",
        currency="USD",
        line_items=line_items,
        feasible=True,
    )

    assert bundle.total <= budget
    assert not (bundle.total > budget)


def test_bundle_line_item_rejects_zero_quantity() -> None:
    with pytest.raises(ValueError):
        BundleLineItem(
            product_id="chair-1",
            category="dining_chair",
            quantity=0,
            unit_price=Money(Decimal("120.00"), "USD"),
        )


def test_feasible_bundle_cannot_carry_violations() -> None:
    with pytest.raises(ValueError):
        Bundle(
            bundle_id="bundle-1",
            revision=1,
            profile_snapshot_id="profile-1",
            catalogue_snapshot_id="snap-1",
            rules_version="rules-1",
            currency="USD",
            line_items=(),
            feasible=True,
            violations=("over_budget",),
        )
