"""`RuleOnlyEncoder` — R02's lexical controlled-vocabulary baseline.

ADR-0006 §D2 redefines the tech design's "no vectors; score from explicit
style/atmosphere tag matches only" into a lexical baseline over
`Product.name` + `Product.overview` text, because `Design Style`/`Tags`
are absent from `Product` entirely (the leakage firewall). Score is 0.5 *
style-descriptor overlap + 0.5 * atmosphere-tag-word overlap. This is a
deliberate deviation from the tech design's wording, made to remove
leakage, not an implementation shortcut — record this in the notebook.

Deterministic: no learned weights, no randomness. Ties broken by
`product_id` ascending.
"""

from __future__ import annotations

import re
from collections.abc import Sequence
from dataclasses import dataclass, field

from curalina_recommendation.domain.eligibility import EligibilityReason
from curalina_recommendation.domain.product import Product
from curalina_recommendation.domain.profile import Profile
from curalina_recommendation.domain.ranking import RankedCandidate

_TOKEN = re.compile(r"[a-zA-Z]+")
_MIN_TOKEN_LEN = 3


def tag_tokens(tag: str) -> frozenset[str]:
    """Word tokens of an atmosphere tag's own name (e.g. `Warm Neutrals`
    -> `{"warm", "neutrals"}`) — the controlled vocabulary for the
    atmosphere axis, never a field read from `Product`."""

    return frozenset(
        token
        for token in (m.lower() for m in _TOKEN.findall(tag))
        if len(token) >= _MIN_TOKEN_LEN
    )


def _encoder_text(product: Product) -> str:
    parts = [product.name]
    if product.overview:
        parts.append(product.overview)
    return " ".join(parts).lower()


def _overlap_score(text: str, terms: frozenset[str]) -> float:
    if not terms:
        return 0.0
    hits = sum(1 for term in terms if term in text)
    return hits / len(terms)


@dataclass(frozen=True, slots=True)
class RuleOnlyEncoder:
    """`style_descriptors` maps a canonical style name to its designer-
    authored descriptor word set (`evaluation.style_descriptors`); it is
    the only style-axis input, never `Product.design_style` (which does
    not exist on `Product` at all)."""

    style_descriptors: dict[str, frozenset[str]] = field(default_factory=dict)

    def rank(
        self, products: Sequence[Product], profile: Profile
    ) -> tuple[RankedCandidate, ...]:
        style_terms = self.style_descriptors.get(profile.style, frozenset())
        atmosphere_terms = tag_tokens(profile.atmosphere)
        candidates = []
        for product in products:
            text = _encoder_text(product)
            style_score = _overlap_score(text, style_terms)
            atmosphere_score = _overlap_score(text, atmosphere_terms)
            score = max(0.0, min(1.0, 0.5 * style_score + 0.5 * atmosphere_score))
            reasons = (
                (EligibilityReason.CATEGORY_MATCH,)
                if product.category in profile.categories
                else (EligibilityReason.CATEGORY_NOT_REQUESTED,)
            )
            candidates.append(
                RankedCandidate(
                    product_id=product.product_id,
                    category=product.category,
                    score=score,
                    reasons=reasons,
                )
            )

        def _sort_key(c: RankedCandidate) -> tuple[float, str]:
            return (-c.score, c.product_id)

        return tuple(sorted(candidates, key=_sort_key))
