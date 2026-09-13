"""Wiring test: `BundleService` orchestrates through the injected
`BundleComposer` port (today, `FakeBundleComposer`, synthetic and
non-spatial). Not a claim that composition or substitution logic is
accepted — see `ports/bundle_composer.py`.
"""

from __future__ import annotations

from decimal import Decimal

from curalina_recommendation.adapters.fake_bundle_composer import FakeBundleComposer
from curalina_recommendation.application.bundle_service import BundleService
from curalina_recommendation.domain.dimensions import Dimensions
from curalina_recommendation.domain.eligibility import Availability
from curalina_recommendation.domain.money import Money
from curalina_recommendation.domain.product import Product, ProductKey
from curalina_recommendation.domain.profile import Profile

_DIMENSIONS = Dimensions.from_inches(width_in=Decimal("10"), height_in=Decimal("5"))


def _priced_product(product_id: str, *, price: Decimal, category: str) -> Product:
    return Product(
        product_id=product_id,
        key=ProductKey.build(supplier_id="sup-1", raw_sku=product_id),
        category=category,
        name=product_id,
        availability=Availability.AVAILABLE,
        price=Money(price, "USD"),
        dimensions=_DIMENSIONS,
    )


def test_bundle_service_composes_a_feasible_bundle_within_budget() -> None:
    sofa = _priced_product("sofa-1", price=Decimal("500.00"), category="sofa")
    table = _priced_product("table-1", price=Decimal("200.00"), category="coffee_table")
    profile = Profile(
        profile_id="profile-1",
        room_type="living_room",
        style="contemporary_luxe",
        atmosphere="bright_airy",
        categories=("sofa", "coffee_table"),
        budget=Money(Decimal("800.00"), "USD"),
    )
    service = BundleService(composer=FakeBundleComposer())

    bundle = service.compose(
        products=[sofa, table],
        profile=profile,
        catalogue_snapshot_id="snap-1",
        rules_version="rules-1",
    )

    assert bundle.feasible is True
    assert bundle.total == Money(Decimal("700.00"), "USD")


def test_bundle_service_substitute_bumps_revision_and_preserves_original() -> None:
    sofa = _priced_product("sofa-1", price=Decimal("500.00"), category="sofa")
    replacement = _priced_product("sofa-2", price=Decimal("450.00"), category="sofa")
    profile = Profile(
        profile_id="profile-1",
        room_type="living_room",
        style="contemporary_luxe",
        atmosphere="bright_airy",
        categories=("sofa",),
        budget=Money(Decimal("800.00"), "USD"),
    )
    service = BundleService(composer=FakeBundleComposer())
    original = service.compose(
        products=[sofa],
        profile=profile,
        catalogue_snapshot_id="snap-1",
        rules_version="rules-1",
    )

    revised = service.substitute(
        bundle=original, replace_product_id="sofa-1", candidate=replacement
    )

    assert revised.bundle_id == original.bundle_id
    assert revised.revision == original.revision + 1
    assert original.revision == 1  # substitution never mutates the original
    assert revised.total == Money(Decimal("450.00"), "USD")
