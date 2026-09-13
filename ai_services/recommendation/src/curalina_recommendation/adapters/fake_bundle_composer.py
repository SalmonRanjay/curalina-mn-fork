"""`FakeBundleComposer` — FAKE ADAPTER, not real bundle/layout logic.

Workflow step 5 (bundle composition and substitutions with full spatial
revalidation via `curalina_design_rules`) is blocked on R03 and is real
logic this adapter deliberately does not perform. This adapter:

- never imports `curalina_design_rules`;
- never computes or checks any placement, clearance, or collision;
- picks at most one product per requested category, by a fixed
  deterministic order (`product_id` ascending) — not a ranking or a
  spatial layout decision;
- marks `feasible` purely from whether every requested category was
  filled and the running total stays within budget.

Any fixture built for this adapter must be labelled synthetic, per
`agentic_flow/recommendation_workflow.md`'s allowance for step 5 to "ship
against synthetic fixtures" while R03 is outstanding.
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass

from curalina_recommendation.domain.bundle import Bundle, BundleLineItem
from curalina_recommendation.domain.errors import CurrencyMismatchError
from curalina_recommendation.domain.product import Product
from curalina_recommendation.domain.profile import Profile

_FIXED_QUANTITY = 1


@dataclass(frozen=True, slots=True)
class FakeBundleComposer:
    """Composes a synthetic, non-spatial bundle: at most one product per
    requested category, chosen by `product_id` ascending, feasible only if
    every category was filled and the total does not exceed budget.
    """

    def compose(
        self,
        *,
        products: Sequence[Product],
        profile: Profile,
        catalogue_snapshot_id: str,
        rules_version: str,
    ) -> Bundle:
        by_category: dict[str, Product] = {}
        for product in sorted(products, key=lambda product: product.product_id):
            already_filled = product.category in by_category
            if product.category in profile.categories and not already_filled:
                by_category[product.category] = product

        missing_categories = [
            category for category in profile.categories if category not in by_category
        ]

        line_items = tuple(
            BundleLineItem(
                product_id=product.product_id,
                category=category,
                quantity=_FIXED_QUANTITY,
                unit_price=product.price,
            )
            for category, product in by_category.items()
            if product.price is not None
        )

        violations: tuple[str, ...] = ()
        if missing_categories:
            violations = (
                f"insufficient_categories: missing {sorted(missing_categories)}",
            )

        bundle = Bundle(
            bundle_id="bundle_fake_0001",
            revision=1,
            profile_snapshot_id=profile.profile_id,
            catalogue_snapshot_id=catalogue_snapshot_id,
            rules_version=rules_version,
            currency=profile.budget.currency,
            line_items=line_items,
            feasible=False,
            violations=violations,
        )

        try:
            over_budget = bundle.total > profile.budget
        except CurrencyMismatchError:
            return Bundle(
                bundle_id=bundle.bundle_id,
                revision=bundle.revision,
                profile_snapshot_id=bundle.profile_snapshot_id,
                catalogue_snapshot_id=bundle.catalogue_snapshot_id,
                rules_version=bundle.rules_version,
                currency=bundle.currency,
                line_items=bundle.line_items,
                feasible=False,
                violations=(*violations, "currency_mismatch"),
            )

        feasible = not missing_categories and not over_budget
        return Bundle(
            bundle_id=bundle.bundle_id,
            revision=bundle.revision,
            profile_snapshot_id=bundle.profile_snapshot_id,
            catalogue_snapshot_id=bundle.catalogue_snapshot_id,
            rules_version=bundle.rules_version,
            currency=bundle.currency,
            line_items=bundle.line_items,
            feasible=feasible,
            violations=() if feasible else (violations or ("over_budget",)),
        )

    def substitute(
        self,
        *,
        bundle: Bundle,
        replace_product_id: str,
        candidate: Product,
    ) -> Bundle:
        """Replace one line item's product, bumping the revision.

        Performs no revalidation beyond recomputing whether the new total
        still fits the bundle's already-fixed `currency`. It never checks
        whether the substitution breaks a previously valid layout — that
        is real logic blocked on R03 (see `ports/bundle_composer.py`).
        """
        if candidate.price is None:
            raise ValueError(
                f"candidate {candidate.product_id!r} has no price; "
                "fake composer cannot substitute an unpriced product"
            )

        new_line_items = tuple(
            BundleLineItem(
                product_id=candidate.product_id,
                category=item.category,
                quantity=item.quantity,
                unit_price=candidate.price,
            )
            if item.product_id == replace_product_id
            else item
            for item in bundle.line_items
        )

        return Bundle(
            bundle_id=bundle.bundle_id,
            revision=bundle.revision + 1,
            profile_snapshot_id=bundle.profile_snapshot_id,
            catalogue_snapshot_id=bundle.catalogue_snapshot_id,
            rules_version=bundle.rules_version,
            currency=bundle.currency,
            line_items=new_line_items,
            feasible=bundle.feasible,
            violations=bundle.violations,
            warnings=(
                *bundle.warnings,
                "fake_bundle_composer_no_layout_revalidation",
            ),
        )
