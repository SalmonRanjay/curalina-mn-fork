"""Logic-only bundle composition under ADR-0013's reduced scope.

This adapter is deterministic application logic, not R03 acceptance evidence.
It may operate on labelled-synthetic fixtures only; unavailable validation arms
surface as `needs_input` violations with their owning `OQ-*` ids.
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from decimal import Decimal

from curalina_recommendation.domain.bundle import Bundle, BundleLineItem
from curalina_recommendation.domain.errors import CurrencyMismatchError
from curalina_recommendation.domain.product import Product
from curalina_recommendation.domain.profile import Profile

SYNTHETIC_FIXTURE_LABEL = "labelled_synthetic_adr0013_logic_only"

_FIXED_QUANTITY = 1
_VALIDATION_NEEDS_INPUT = (
    "needs_input:style_proportion:OQ-002",
    "needs_input:material_rules:OQ-004",
    "needs_input:anchor_hex_library:OQ-007",
    "needs_input:catalogue_attributes:OQ-009",
    "needs_input:furniture_catalogue:OQ-011",
)
_NO_ACCEPTANCE_WARNING = (
    "r03_no_go_real_data_logic_only_labelled_synthetic_fixtures"
)


@dataclass(frozen=True, slots=True)
class LogicOnlyBundleComposer:
    """Compose and revise bundles without claiming catalogue/model quality."""

    def compose(
        self,
        *,
        products: Sequence[Product],
        profile: Profile,
        catalogue_snapshot_id: str,
        rules_version: str,
    ) -> Bundle:
        selected = _select_lowest_price_per_category(tuple(products), profile)
        line_items = _line_items(selected)
        violations = _validation_violations(selected)
        missing_categories = tuple(
            category
            for category in profile.categories
            if category not in {product.category for product in selected}
        )
        if missing_categories:
            violations = (
                *violations,
                f"insufficient_categories:missing={','.join(sorted(missing_categories))}",
            )

        bundle = Bundle(
            bundle_id="bundle_logic_0001",
            revision=1,
            profile_snapshot_id=profile.profile_id,
            catalogue_snapshot_id=catalogue_snapshot_id,
            rules_version=rules_version,
            currency=profile.budget.currency,
            line_items=line_items,
            feasible=False,
            violations=violations,
            warnings=(_NO_ACCEPTANCE_WARNING,),
        )

        try:
            over_budget = bundle.total > profile.budget
        except CurrencyMismatchError:
            return _replace_violations(bundle, (*violations, "currency_mismatch"))

        if over_budget:
            return _replace_violations(bundle, (*violations, "over_budget"))
        return bundle

    def substitute(
        self,
        *,
        bundle: Bundle,
        replace_product_id: str,
        candidate: Product,
    ) -> Bundle:
        if candidate.price is None:
            raise ValueError(
                f"candidate {candidate.product_id!r} has no price; "
                "logic-only composer cannot substitute an unpriced product"
            )

        replaced = False
        new_items: list[BundleLineItem] = []
        violations = tuple(
            violation for violation in bundle.violations if not violation.startswith(
                "needs_input:"
            )
        )
        for item in bundle.line_items:
            if item.product_id != replace_product_id:
                new_items.append(item)
                continue
            replaced = True
            if item.category != candidate.category:
                violations = (
                    *violations,
                    f"incompatible_pair:expected_category={item.category}:"
                    f"candidate_category={candidate.category}",
                )
            new_items.append(
                BundleLineItem(
                    product_id=candidate.product_id,
                    category=item.category,
                    quantity=item.quantity,
                    unit_price=candidate.price,
                )
            )

        if not replaced:
            raise ValueError(f"bundle does not contain product {replace_product_id!r}")

        revised = Bundle(
            bundle_id=bundle.bundle_id,
            revision=bundle.revision + 1,
            profile_snapshot_id=bundle.profile_snapshot_id,
            catalogue_snapshot_id=bundle.catalogue_snapshot_id,
            rules_version=bundle.rules_version,
            currency=bundle.currency,
            line_items=tuple(new_items),
            feasible=False,
            violations=(*_validation_violations((candidate,)), *violations),
            warnings=(*bundle.warnings, _NO_ACCEPTANCE_WARNING),
        )

        try:
            _ = revised.total
        except CurrencyMismatchError:
            return _replace_violations(
                revised, (*revised.violations, "currency_mismatch")
            )
        return revised


def _select_lowest_price_per_category(
    products: tuple[Product, ...], profile: Profile
) -> tuple[Product, ...]:
    selected: list[Product] = []
    for category in profile.categories:
        candidates = [
            product
            for product in products
            if product.category == category
            and product.price is not None
            and product.price.currency == profile.budget.currency
            and product.price <= profile.budget
        ]
        candidates.sort(key=_priced_sort_key)
        if candidates:
            selected.append(candidates[0])
    return tuple(selected)


def _priced_sort_key(product: Product) -> tuple[Decimal, str]:
    if product.price is None:
        raise ValueError(f"product {product.product_id!r} has no price")
    return product.price.amount, product.product_id


def _line_items(products: tuple[Product, ...]) -> tuple[BundleLineItem, ...]:
    return tuple(
        BundleLineItem(
            product_id=product.product_id,
            category=product.category,
            quantity=_FIXED_QUANTITY,
            unit_price=product.price,
        )
        for product in products
        if product.price is not None
    )


def _validation_violations(products: tuple[Product, ...]) -> tuple[str, ...]:
    if any(product.fixture_label != SYNTHETIC_FIXTURE_LABEL for product in products):
        return (
            "needs_input:real_catalogue_composition:OQ-011",
            *_VALIDATION_NEEDS_INPUT,
        )
    return _VALIDATION_NEEDS_INPUT


def _replace_violations(bundle: Bundle, violations: tuple[str, ...]) -> Bundle:
    return Bundle(
        bundle_id=bundle.bundle_id,
        revision=bundle.revision,
        profile_snapshot_id=bundle.profile_snapshot_id,
        catalogue_snapshot_id=bundle.catalogue_snapshot_id,
        rules_version=bundle.rules_version,
        currency=bundle.currency,
        line_items=bundle.line_items,
        feasible=False,
        violations=violations,
        warnings=bundle.warnings,
    )
