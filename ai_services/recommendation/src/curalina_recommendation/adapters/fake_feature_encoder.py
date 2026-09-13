"""`FakeFeatureEncoder` — FAKE ADAPTER, not rule-only or embedding ranking.

Neither the rule-only baseline (workflow step 3, blocked on R02) nor the
MiniLM embedding adapter (step 4, blocked on R02's held-out gate) exists.
This adapter performs a single trivial, explicitly-labelled-fake
computation — an exact category-match indicator, nothing else — purely so
`application.ranking_service.RankingService` has something to call. It
must never be read as evidence about ranking quality, and it is not the
rule-only baseline: it applies no style/atmosphere weighting, no
tie-break-by-content rule, and no learned or hand-tuned scoring at all.
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass

from curalina_recommendation.domain.eligibility import EligibilityReason
from curalina_recommendation.domain.product import Product
from curalina_recommendation.domain.profile import Profile
from curalina_recommendation.domain.ranking import RankedCandidate

_MATCH_SCORE = 1.0
_NO_MATCH_SCORE = 0.0


@dataclass(frozen=True, slots=True)
class FakeFeatureEncoder:
    """Scores 1.0 if `product.category` is in `profile.categories`, else 0.0.

    This is fixture-grade behaviour only: it exists to exercise the
    `FeatureEncoder` port and `RankingService`'s orchestration (budget
    filtering, currency-mismatch propagation) without claiming any actual
    ranking algorithm is accepted.
    """

    def rank(
        self, products: Sequence[Product], profile: Profile
    ) -> tuple[RankedCandidate, ...]:
        requested = set(profile.categories)
        candidates = [
            RankedCandidate(
                product_id=product.product_id,
                category=product.category,
                score=(
                    _MATCH_SCORE if product.category in requested else _NO_MATCH_SCORE
                ),
                reasons=(
                    (EligibilityReason.CATEGORY_MATCH,)
                    if product.category in requested
                    else (EligibilityReason.CATEGORY_NOT_REQUESTED,)
                ),
            )
            for product in products
        ]
        # Deterministic ordering only (score desc, then product_id asc) so
        # repeated calls are stable for callers/tests; this is NOT the
        # accepted "equal-score deterministic tie-breaking" named test,
        # which requires the real rule-only ranking algorithm (blocked on
        # R02) to produce meaningful ties in the first place.
        def _sort_key(candidate: RankedCandidate) -> tuple[float, str]:
            return (-candidate.score, candidate.product_id)

        return tuple(sorted(candidates, key=_sort_key))
