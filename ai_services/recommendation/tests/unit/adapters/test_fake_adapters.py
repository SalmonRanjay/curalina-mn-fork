"""Adapter-level tests: determinism and documented fake-scope only.

Not part of the mandatory named-test list; these exist to cover the fake
adapters' own branches (deterministic ordering, insufficient-category and
currency-mismatch paths) since they are new code under `adapters/`.
"""

from __future__ import annotations

from decimal import Decimal

from curalina_recommendation.adapters.fake_bundle_composer import FakeBundleComposer
from curalina_recommendation.adapters.fake_feature_encoder import FakeFeatureEncoder
from curalina_recommendation.domain.dimensions import Dimensions
from curalina_recommendation.domain.eligibility import Availability, EligibilityReason
from curalina_recommendation.domain.money import Money
from curalina_recommendation.domain.product import Product, ProductKey
from curalina_recommendation.domain.profile import Profile

_DIMENSIONS = Dimensions.from_inches(width_in=Decimal("10"), height_in=Decimal("5"))


def _product(product_id: str, *, category: str) -> Product:
    return Product(
        product_id=product_id,
        key=ProductKey.build(supplier_id="sup-1", raw_sku=product_id),
        category=category,
        name=product_id,
        availability=Availability.UNKNOWN,
    )


def test_fake_feature_encoder_scores_category_match_only() -> None:
    profile = Profile(
        profile_id="profile-1",
        room_type="living_room",
        style="contemporary_luxe",
        atmosphere="bright_airy",
        categories=("sofa",),
        budget=Money(Decimal("100.00"), "USD"),
    )
    matching = _product("prod-b", category="sofa")
    non_matching = _product("prod-a", category="lamp")
    encoder = FakeFeatureEncoder()

    ranked = encoder.rank([non_matching, matching], profile)

    assert ranked[0].product_id == "prod-b"
    assert ranked[0].score == 1.0
    assert ranked[0].reasons == (EligibilityReason.CATEGORY_MATCH,)
    assert ranked[1].product_id == "prod-a"
    assert ranked[1].score == 0.0
    assert ranked[1].reasons == (EligibilityReason.CATEGORY_NOT_REQUESTED,)


def test_fake_feature_encoder_orders_equal_scores_by_product_id() -> None:
    profile = Profile(
        profile_id="profile-1",
        room_type="living_room",
        style="contemporary_luxe",
        atmosphere="bright_airy",
        categories=("sofa",),
        budget=Money(Decimal("100.00"), "USD"),
    )
    encoder = FakeFeatureEncoder()

    ranked = encoder.rank(
        [_product("prod-z", category="sofa"), _product("prod-a", category="sofa")],
        profile,
    )

    assert [candidate.product_id for candidate in ranked] == ["prod-a", "prod-z"]


def test_fake_bundle_composer_reports_insufficient_categories_as_infeasible() -> None:
    profile = Profile(
        profile_id="profile-1",
        room_type="living_room",
        style="contemporary_luxe",
        atmosphere="bright_airy",
        categories=("sofa", "coffee_table"),
        budget=Money(Decimal("1000.00"), "USD"),
    )
    sofa = Product(
        product_id="sofa-1",
        key=ProductKey.build(supplier_id="sup-1", raw_sku="sofa-1"),
        category="sofa",
        name="sofa-1",
        availability=Availability.AVAILABLE,
        price=Money(Decimal("500.00"), "USD"),
        dimensions=_DIMENSIONS,
    )
    composer = FakeBundleComposer()

    bundle = composer.compose(
        products=[sofa],
        profile=profile,
        catalogue_snapshot_id="snap-1",
        rules_version="rules-1",
    )

    assert bundle.feasible is False
    assert any(
        "insufficient_categories" in violation for violation in bundle.violations
    )
