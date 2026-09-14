"""Resolves a brief's Layer-1-eligible, labelled candidate set: precondition
(room type + category) plus budget/dimension hard filters (§D3 Stratum B),
joined against label rows so ranking and metrics operate on the same set.

Products carrying `unmapped` labels for a style/atmosphere brief are
excluded from the candidate set entirely for that brief (documented
simplification: relevance is undefined for them, so neither ranking
credit nor penalty can be computed; their count is reported separately as
`unmapped` coverage, never folded into a ranking failure).
"""

from __future__ import annotations

from dataclasses import dataclass

from curalina_recommendation.domain.product import Product
from curalina_recommendation.evaluation.label_rules import Brief, LabelResult
from curalina_recommendation.evaluation.label_source import LabelSourceRecord


@dataclass(frozen=True, slots=True)
class CandidateSet:
    brief_id: str
    products: tuple[Product, ...]
    labels: dict[str, int]  # product_id -> grade, labelled candidates only
    suppliers: dict[str, str]  # product_id -> supplier_id
    unmapped_count: int
    unmapped_rate: float
    partial_normalization_count: int
    layer1_excluded_count: int
    total_precondition_eligible: int


def _passes_layer1(record: LabelSourceRecord, brief: Brief) -> bool:
    if brief.budget_max is not None:
        if record.price is None or record.price > brief.budget_max:
            return False
    if brief.max_dimension_in is not None:
        if record.width_in is None or record.width_in > brief.max_dimension_in:
            return False
    return True


def build_candidate_set(
    brief: Brief,
    products_by_id: dict[str, Product],
    records: tuple[LabelSourceRecord, ...],
    label_results: list[LabelResult],
) -> CandidateSet:
    results_by_id = {r.product_id: r for r in label_results}
    records_by_id = {r.product_id: r for r in records}

    precondition_ids = [pid for pid, r in results_by_id.items() if r.precondition]
    layer1_excluded = 0
    labelled_ids: list[str] = []
    unmapped_count = 0
    partial_count = 0
    labels: dict[str, int] = {}
    suppliers: dict[str, str] = {}

    for pid in precondition_ids:
        record = records_by_id.get(pid)
        result = results_by_id[pid]
        if record is not None and not _passes_layer1(record, brief):
            layer1_excluded += 1
            continue
        if result.unmapped:
            unmapped_count += 1
            continue
        if result.partial_normalization:
            partial_count += 1
        if result.grade is not None and pid in products_by_id:
            labels[pid] = result.grade
            suppliers[pid] = result.supplier_id
            labelled_ids.append(pid)

    products = tuple(products_by_id[pid] for pid in labelled_ids)
    total_precondition = len(precondition_ids)
    unmapped_rate = unmapped_count / total_precondition if total_precondition else 0.0

    return CandidateSet(
        brief_id=brief.brief_id,
        products=products,
        labels=labels,
        suppliers=suppliers,
        unmapped_count=unmapped_count,
        unmapped_rate=unmapped_rate,
        partial_normalization_count=partial_count,
        layer1_excluded_count=layer1_excluded,
        total_precondition_eligible=total_precondition,
    )
