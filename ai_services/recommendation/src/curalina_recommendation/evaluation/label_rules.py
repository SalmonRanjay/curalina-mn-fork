"""§D4/§D4a relevance-label derivation.

A published, deterministic function over designer-authored columns
(`Room Type`, `Design Style`, `Tags`, `Furniture Category`) — never the
label function reading `name`/`overview`/material text, never an encoder
output (ADR-0006 §D2, §D4). Grades follow the reference notebook's 0/1/2
scale.
"""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from enum import StrEnum

from curalina_recommendation.evaluation.label_source import LabelSourceRecord
from curalina_recommendation.evaluation.vocabulary import Bucket, VocabularyMap


class AxisStatus(StrEnum):
    RESOLVED = "resolved"
    UNMAPPED = "unmapped"  # every token in the axis's column is unresolvable


@dataclass(frozen=True, slots=True)
class AxisResult:
    status: AxisStatus
    matched: bool
    partial_unresolved: bool


def evaluate_axis(
    tokens: tuple[str, ...], axis: str, target: str, vocab: VocabularyMap
) -> AxisResult:
    """Classify every token in one product's axis column and decide
    whether `target` is among the resolved canonical terms.

    Per §D4a: a product is `unmapped` for the axis iff *every* token is
    `unresolvable`. A product with some canonical and some unresolvable
    tokens is labelled on what resolves; the unresolved residual is
    `partial_unresolved` (a non-gating diagnostic, §D4a).
    """

    if not tokens:
        return AxisResult(AxisStatus.UNMAPPED, matched=False, partial_unresolved=False)
    canonical_hits: set[str] = set()
    any_unresolvable = False
    any_resolved = False
    for token in tokens:
        bucket, canon = vocab.classify(token, axis)
        if bucket is Bucket.CANONICAL:
            any_resolved = True
            assert canon is not None
            canonical_hits.add(canon)
        elif bucket is Bucket.OUT_OF_AXIS:
            continue
        else:
            any_unresolvable = True
    if not any_resolved:
        return AxisResult(AxisStatus.UNMAPPED, matched=False, partial_unresolved=False)
    return AxisResult(
        AxisStatus.RESOLVED,
        matched=target in canonical_hits,
        partial_unresolved=any_unresolvable,
    )


@dataclass(frozen=True, slots=True)
class Brief:
    """One evaluation brief. `style`/`atmosphere` are `None` for Stratum
    B/C briefs that test constraint survival rather than the style/
    atmosphere axis (§D3)."""

    brief_id: str
    stratum: str  # "A" | "B" | "C"
    room_type: str
    categories: tuple[str, ...]
    style: str | None = None
    atmosphere: str | None = None
    budget_max: Decimal | None = None
    budget_percentile: float | None = None
    max_dimension_in: Decimal | None = None
    note: str = ""


@dataclass(frozen=True, slots=True)
class LabelResult:
    product_id: str
    supplier_id: str
    precondition: bool
    grade: int | None  # None means excluded (unmapped axis)
    unmapped: bool
    partial_normalization: bool


def _room_match(
    record: LabelSourceRecord, room_type: str, vocab: VocabularyMap
) -> bool:
    for token in record.room_types_raw:
        bucket, canon = vocab.classify(token, "room")
        if bucket is Bucket.CANONICAL and canon == room_type:
            return True
    return False


def _category_match(record: LabelSourceRecord, categories: tuple[str, ...]) -> bool:
    wanted = {c.strip().lower() for c in categories}
    return any(token.strip().lower() in wanted for token in record.categories_raw)


def label_product(
    brief: Brief, record: LabelSourceRecord, vocab: VocabularyMap
) -> LabelResult:
    precondition = _room_match(record, brief.room_type, vocab) and _category_match(
        record, brief.categories
    )
    if not precondition:
        return LabelResult(
            record.product_id, record.supplier_id, False, 0, False, False
        )

    if brief.style is None or brief.atmosphere is None:
        # Stratum B/C constraint-only briefs: precondition alone is
        # relevance (grade 1); no style/atmosphere axis is being tested.
        return LabelResult(record.product_id, record.supplier_id, True, 1, False, False)

    style_result = evaluate_axis(record.design_styles_raw, "style", brief.style, vocab)
    tag_result = evaluate_axis(record.tags_raw, "tag", brief.atmosphere, vocab)

    axis_unmapped = (
        style_result.status is AxisStatus.UNMAPPED
        or tag_result.status is AxisStatus.UNMAPPED
    )
    if axis_unmapped:
        return LabelResult(
            record.product_id, record.supplier_id, True, None, True, False
        )

    partial = style_result.partial_unresolved or tag_result.partial_unresolved
    if style_result.matched and tag_result.matched:
        grade = 2
    elif style_result.matched or tag_result.matched:
        grade = 1
    else:
        grade = 0
    return LabelResult(
        record.product_id, record.supplier_id, True, grade, False, partial
    )
