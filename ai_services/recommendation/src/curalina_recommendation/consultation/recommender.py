"""Score the catalogue for one quiz submission and place one product per room slot.

1. Validate the answers; anything missing comes back as `NeedsInput`, never a default.
2. Score every catalogue product with the trained model (`model.py`).
3. Walk the room's Design Manual slots (`room_plan.py`) foundation first, and
   put the highest-scoring *priced* product scoring at least
   `min_match_score` that still fits the remaining investment ceiling.

`rule_match` is reported next to every score: it is the labelling rule the
model was trained to reproduce (notebook section 4), so a row where the two
disagree is a visible model error rather than a silent one.
"""

from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np

from curalina_recommendation.consultation.catalogue import Catalogue, CatalogueProduct
from curalina_recommendation.consultation.model import ModelInfo, TwoTowerScorer
from curalina_recommendation.consultation.quiz import (
    ConsultationAnswers,
    Query,
    investment_ceiling,
    to_query,
    validate,
)
from curalina_recommendation.consultation.room_plan import (
    MANUAL_SOURCE,
    ROOM_PLANS,
    Slot,
)

DEFAULT_MIN_MATCH_SCORE = 0.5
DEFAULT_ALTERNATIVES_PER_SLOT = 3


def matches_rule(q: Query, p: CatalogueProduct) -> bool:
    """The notebook's `is_match`, verbatim in meaning (section 4)."""
    if q.room not in p.rooms or q.atmosphere not in p.atmospheres:
        return False
    if q.aesthetic not in p.styles and q.materiality not in p.styles:
        return False
    if p.touches and not set(q.touches) & set(p.touches):
        return False
    if p.seating is not None and q.seating is not None and p.seating != q.seating:
        return False
    if p.bed_size is not None and q.bed_size is not None and p.bed_size != q.bed_size:
        return False
    return True


@dataclass(frozen=True, slots=True)
class ScoredProduct:
    product: CatalogueProduct
    match_score: float
    rule_match: bool


@dataclass(frozen=True, slots=True)
class Placement:
    slot_id: str
    tier: str
    label: str
    scored: ScoredProduct
    quantity: int
    quantity_source: str
    unit_price: float
    line_total: float


@dataclass(frozen=True, slots=True)
class NeedsInput:
    problems: tuple[str, ...]


@dataclass(frozen=True)
class Recommendation:
    room: str
    placements: tuple[Placement, ...]
    alternatives: dict[str, tuple[ScoredProduct, ...]]
    total: float
    ceiling: float | None
    notes: tuple[str, ...]
    not_in_catalogue: tuple[str, ...]
    plan_source: str
    model: ModelInfo
    catalogue_fingerprint: str
    model_rule_disagreements: int
    products_scored: int = field(default=0)


class ConsultationRecommender:
    def __init__(
        self,
        catalogue: Catalogue,
        scorer: TwoTowerScorer,
        *,
        min_match_score: float = DEFAULT_MIN_MATCH_SCORE,
        alternatives_per_slot: int = DEFAULT_ALTERNATIVES_PER_SLOT,
    ) -> None:
        self._catalogue = catalogue
        self._scorer = scorer
        self._matrix = scorer.encode_products(catalogue.products)
        self._min_match_score = min_match_score
        self._alternatives = alternatives_per_slot

    @property
    def catalogue(self) -> Catalogue:
        return self._catalogue

    @property
    def model(self) -> ModelInfo:
        return self._scorer.info

    def score(self, query: Query) -> list[ScoredProduct]:
        """Every catalogue product, best first (ties keep catalogue order)."""
        products = self._catalogue.products
        if not products:
            return []
        scores = self._scorer.score(query, self._matrix)
        order = np.argsort(-scores, kind="stable")
        return [
            ScoredProduct(
                products[i], float(scores[i]), matches_rule(query, products[i])
            )
            for i in order
        ]

    def recommend(self, answers: ConsultationAnswers) -> Recommendation | NeedsInput:
        problems = validate(answers)
        if problems:
            return NeedsInput(tuple(problems))
        assert answers.investment is not None
        query = to_query(answers)
        plan = ROOM_PLANS[query.room]
        scored = self.score(query)
        ceiling_units = investment_ceiling(answers.investment)
        ceiling = float(ceiling_units) if ceiling_units is not None else None
        remaining = ceiling
        notes: list[str] = []
        if ceiling is None:
            notes.append(
                f"{answers.investment} has no upper bound: no budget ceiling applied"
            )
        if answers.pattern_preference:
            notes.append(
                "pattern density does not affect the products: "
                "the catalogue has no pattern data"
            )

        placements: list[Placement] = []
        alternatives: dict[str, tuple[ScoredProduct, ...]] = {}
        for slot in plan.slots:
            placement, pool, slot_notes = self._fill_slot(
                slot, scored, query, placements, remaining
            )
            notes.extend(slot_notes)
            if placement is not None:
                placements.append(placement)
                if remaining is not None:
                    remaining -= placement.line_total
            chosen_id = placement.scored.product.product_id if placement else None
            alternatives[slot.slot_id] = tuple(
                s
                for s in pool
                if s.product.product_id != chosen_id and s.product.price is not None
            )[: self._alternatives]

        disagreements = sum(
            1
            for s in scored
            if (s.match_score >= self._min_match_score) != s.rule_match
        )
        return Recommendation(
            room=query.room,
            placements=tuple(placements),
            alternatives=alternatives,
            total=sum(p.line_total for p in placements),
            ceiling=ceiling,
            notes=tuple(notes),
            not_in_catalogue=plan.not_in_catalogue,
            plan_source=MANUAL_SOURCE,
            model=self._scorer.info,
            catalogue_fingerprint=self._catalogue.report.fingerprint,
            model_rule_disagreements=disagreements,
            products_scored=len(scored),
        )

    def _quantity(
        self, slot: Slot, query: Query, placed: list[Placement]
    ) -> tuple[int, str, str | None]:
        if slot.quantity_rule == "pair":
            return 2, "matched pair (Design Manual §9.4.1)", None
        if slot.quantity_rule == "seating":
            if query.seating is not None:
                return query.seating, "seating answer", None
            table = next((p for p in placed if p.slot_id == "dining_table"), None)
            if table is not None and table.scored.product.seating is not None:
                return table.scored.product.seating, "chosen table's seating", None
            return (
                1,
                "no seating answer or table seating",
                (
                    f"{slot.label}: no seating answer and no table seating count, "
                    "so 1 is shown"
                ),
            )
        return 1, "one per slot", None

    def _fill_slot(
        self,
        slot: Slot,
        scored: list[ScoredProduct],
        query: Query,
        placed: list[Placement],
        remaining: float | None,
    ) -> tuple[Placement | None, list[ScoredProduct], list[str]]:
        notes: list[str] = []
        quantity, source, quantity_note = self._quantity(slot, query, placed)
        if quantity_note:
            notes.append(quantity_note)
        for categories in (slot.categories, slot.fallback_categories):
            if not categories:
                continue
            pool = [
                s
                for s in scored
                if s.product.category in categories
                and s.match_score >= self._min_match_score
            ]
            if not pool:
                continue
            priced = [s for s in pool if s.product.price is not None]
            if not priced:
                notes.append(
                    f"{slot.label}: matching products exist but none has a usable price"
                )
                return None, pool, notes
            fits = [
                s
                for s in priced
                if remaining is None or (s.product.price or 0.0) * quantity <= remaining
            ]
            if not fits:
                cheapest = min((s.product.price or 0.0) * quantity for s in priced)
                notes.append(
                    f"{slot.label}: cheapest match ({cheapest:,.0f}) exceeds "
                    "the remaining "
                    f"budget ({remaining:,.0f})"
                )
                return None, pool, notes
            pick = fits[0]
            if categories is slot.fallback_categories:
                notes.append(
                    f"{slot.label}: no sofa matched, so a "
                    f"{pick.product.category} anchors the room"
                )
            unit = float(pick.product.price or 0.0)
            return (
                Placement(
                    slot_id=slot.slot_id,
                    tier=slot.tier,
                    label=slot.label,
                    scored=pick,
                    quantity=quantity,
                    quantity_source=source,
                    unit_price=unit,
                    line_total=unit * quantity,
                ),
                pool,
                notes,
            )
        notes.append(
            f"{slot.label}: no product scores at least {self._min_match_score} "
            "for these answers"
        )
        return None, [], notes
