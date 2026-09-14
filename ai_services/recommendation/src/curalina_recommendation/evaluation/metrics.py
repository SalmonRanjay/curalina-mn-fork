"""R02 metrics: Precision@5, NDCG@5 (graded gains), the mandatory
prevalence baseline (§D6b), the mandatory shuffled-label control (§D7),
and the mixed-pool supplier-proxy guard (Amendment 1 §D3a-G / ADR-0007).
"""

from __future__ import annotations

import math
import random
from dataclasses import dataclass

K = 5


def precision_at_k(graded_relevances: list[int], *, k: int = K) -> float:
    """Relevance = label >= 1, per ADR-0006 §D7's reporting spec."""

    top = graded_relevances[:k]
    if not top:
        return 0.0
    return sum(1 for g in top if g >= 1) / len(top)


def _dcg(grades: list[int]) -> float:
    return sum(g / math.log2(i + 2) for i, g in enumerate(grades))


def ndcg_at_k(
    graded_relevances_in_rank_order: list[int],
    all_relevances_for_brief: list[int],
    *,
    k: int = K,
) -> float | None:
    """`None` (undefined) when the brief has no relevant labelled item at
    all, per ADR-0006 §D7 ("NDCG marked undefined, and counted")."""

    ideal = sorted(all_relevances_for_brief, reverse=True)[:k]
    idcg = _dcg(ideal)
    if idcg == 0.0:
        return None
    return _dcg(graded_relevances_in_rank_order[:k]) / idcg


@dataclass(frozen=True, slots=True)
class PrevalenceBaseline:
    """§D6b's mandatory fourth arm: the analytic expectation for a random
    ranker (`E[P@5] = r_union`) and the observed P@5 of a deterministic
    no-op ranker returning eligible products in source-snapshot row order.
    """

    analytic_expected_p_at_5: float
    observed_no_op_p_at_5: float


def prevalence_baseline(
    labelled_products_in_source_order: list[tuple[str, int]], *, k: int = K
) -> PrevalenceBaseline:
    grades = [g for _, g in labelled_products_in_source_order]
    r_union = sum(1 for g in grades if g >= 1) / len(grades) if grades else 0.0
    no_op_top_k = [g for _, g in labelled_products_in_source_order[:k]]
    return PrevalenceBaseline(
        analytic_expected_p_at_5=r_union,
        observed_no_op_p_at_5=precision_at_k(no_op_top_k, k=k),
    )


def shuffled_labels(
    product_ids: list[str], grades: list[int], *, seed: int
) -> dict[str, int]:
    """Permute labels across products within a brief at a fixed seed
    (ADR-0006 §D7, mandatory). If an arm scores near its real value under
    permuted labels, the metric is not measuring what the run claims."""

    rng = random.Random(seed)
    shuffled = list(grades)
    rng.shuffle(shuffled)
    return dict(zip(product_ids, shuffled, strict=True))


def supplier_proxy_gap(
    positive_suppliers: list[str], pool_suppliers: list[str], *, four_hands_label: str
) -> float | None:
    """`|P(FH | label >= 1) - P(FH | pool)|`, per Amendment 1 §D3a-G /
    ADR-0007's mixed-pool guard. Returns `None` when the pool is
    supplier-homogeneous (the guard is inert there — no supplier signal to
    exploit)."""

    if not pool_suppliers:
        return None
    fh_pool_rate = sum(1 for s in pool_suppliers if s == four_hands_label) / len(
        pool_suppliers
    )
    minority_share = min(fh_pool_rate, 1 - fh_pool_rate)
    if minority_share < 0.15:
        return None
    if not positive_suppliers:
        return None
    fh_positives = sum(1 for s in positive_suppliers if s == four_hands_label)
    fh_positive_rate = fh_positives / len(positive_suppliers)
    return abs(fh_positive_rate - fh_pool_rate)


def bootstrap_mean_interval(
    values: list[float], *, seed: int, n_resamples: int = 2000, alpha: float = 0.05
) -> tuple[float, float, float]:
    """A bootstrap interval over briefs, reported *with* the statement
    that n=6 held-out briefs makes it wide by construction (§D7)."""

    rng = random.Random(seed)
    if not values:
        return (0.0, 0.0, 0.0)
    point = sum(values) / len(values)
    if len(values) < 2:
        return (point, point, point)
    means = []
    for _ in range(n_resamples):
        sample = [values[rng.randrange(len(values))] for _ in values]
        means.append(sum(sample) / len(sample))
    means.sort()
    lo_idx = int((alpha / 2) * n_resamples)
    hi_idx = int((1 - alpha / 2) * n_resamples) - 1
    return (point, means[max(0, lo_idx)], means[min(n_resamples - 1, hi_idx)])
