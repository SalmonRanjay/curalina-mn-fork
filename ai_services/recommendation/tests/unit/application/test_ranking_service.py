"""Named tests at the application-orchestration level: exact budget
boundary and currency mismatch, exercised through `RankingService` wired
to the `FakeFeatureEncoder` fake adapter (this is the "testable now" A2
wiring the task calls for, not a claim that ranking itself is accepted).
"""

from __future__ import annotations

from decimal import Decimal

import pytest

from curalina_recommendation.adapters.fake_feature_encoder import FakeFeatureEncoder
from curalina_recommendation.application.ranking_service import RankingService
from curalina_recommendation.domain.dimensions import Dimensions
from curalina_recommendation.domain.eligibility import Availability
from curalina_recommendation.domain.errors import CurrencyMismatchError
from curalina_recommendation.domain.money import Money
from curalina_recommendation.domain.product import Product, ProductKey
from curalina_recommendation.domain.profile import Profile

_DIMENSIONS = Dimensions.from_inches(width_in=Decimal("10"), height_in=Decimal("5"))


def _priced_product(
    product_id: str, *, price: Money, category: str = "wall_art"
) -> Product:
    return Product(
        product_id=product_id,
        key=ProductKey.build(supplier_id="sup-1", raw_sku=product_id),
        category=category,
        name=product_id,
        availability=Availability.AVAILABLE,
        price=price,
        dimensions=_DIMENSIONS,
    )


def _profile(*, budget: Money, categories: tuple[str, ...] = ("wall_art",)) -> Profile:
    return Profile(
        profile_id="profile-1",
        room_type="living_room",
        style="contemporary_luxe",
        atmosphere="bright_airy",
        categories=categories,
        budget=budget,
    )


def test_product_priced_exactly_at_budget_is_included() -> None:
    budget = Money(Decimal("100.00"), "USD")
    at_budget = _priced_product("prod-at-budget", price=Money(Decimal("100.00"), "USD"))
    over_budget = _priced_product(
        "prod-over-budget", price=Money(Decimal("100.01"), "USD")
    )
    service = RankingService(encoder=FakeFeatureEncoder())

    candidates = service.recommend(
        products=[at_budget, over_budget], profile=_profile(budget=budget)
    )

    product_ids = {candidate.product_id for candidate in candidates}
    assert "prod-at-budget" in product_ids
    assert "prod-over-budget" not in product_ids


def test_product_one_minor_unit_under_budget_is_included() -> None:
    budget = Money(Decimal("100.00"), "USD")
    under_budget = _priced_product("prod-under", price=Money(Decimal("99.99"), "USD"))
    service = RankingService(encoder=FakeFeatureEncoder())

    candidates = service.recommend(
        products=[under_budget], profile=_profile(budget=budget)
    )

    assert {candidate.product_id for candidate in candidates} == {"prod-under"}


def test_unpriced_product_is_excluded_never_treated_as_affordable() -> None:
    unpriced = Product(
        product_id="prod-unpriced",
        key=ProductKey.build(supplier_id="sup-1", raw_sku="prod-unpriced"),
        category="wall_art",
        name="prod-unpriced",
        availability=Availability.UNKNOWN,
    )
    service = RankingService(encoder=FakeFeatureEncoder())

    candidates = service.recommend(
        products=[unpriced], profile=_profile(budget=Money(Decimal("100.00"), "USD"))
    )

    assert candidates == ()


def test_currency_mismatch_between_product_and_profile_budget_raises() -> None:
    cad_priced = _priced_product("prod-cad", price=Money(Decimal("50.00"), "CAD"))
    service = RankingService(encoder=FakeFeatureEncoder())

    usd_budget_profile = _profile(budget=Money(Decimal("100.00"), "USD"))
    with pytest.raises(CurrencyMismatchError) as excinfo:
        service.recommend(products=[cad_priced], profile=usd_budget_profile)

    assert excinfo.value.expected == "CAD"
    assert excinfo.value.actual == "USD"
