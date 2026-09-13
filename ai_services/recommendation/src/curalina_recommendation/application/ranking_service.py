"""`RankingService` — application-layer orchestration for `/v1/recommendations`.

Owns the budget-filtering decision (exact-boundary inclusive, currency
mismatch propagated as a typed error) and delegates scoring to whichever
`FeatureEncoder` is injected. Only `adapters.FakeFeatureEncoder` exists
today; the rule-only and embedding adapters (workflow steps 3 and 4) are
drop-in replacements of the same port once their notebook gates clear.
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass

from curalina_recommendation.domain.product import Product
from curalina_recommendation.domain.profile import Profile
from curalina_recommendation.domain.ranking import RankedCandidate
from curalina_recommendation.ports.feature_encoder import FeatureEncoder


@dataclass(frozen=True, slots=True)
class RankingService:
    encoder: FeatureEncoder

    def recommend(
        self, *, products: Sequence[Product], profile: Profile
    ) -> tuple[RankedCandidate, ...]:
        """Rank `products` against `profile`, after budget filtering.

        A product with no price is excluded (unpriced products can never
        be shoppable-mode candidates). A product whose price currency does
        not match `profile.budget.currency` raises `CurrencyMismatchError`
        rather than being silently skipped or coerced — a mixed-currency
        catalogue/profile pairing is an input error the caller must fix,
        not a per-product filter decision this service should make
        quietly.
        """
        affordable = [
            product
            for product in products
            if product.price is not None and product.price <= profile.budget
        ]
        return self.encoder.rank(affordable, profile)
