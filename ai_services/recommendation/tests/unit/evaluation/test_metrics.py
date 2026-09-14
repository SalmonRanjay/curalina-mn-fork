"""Precision@5/NDCG@5 edge cases, the prevalence-baseline analytic formula
(§D6b), the shuffled-label control (§D7), the mixed-pool supplier-proxy
guard (Amendment 1 §D3a-G / ADR-0007), and the bootstrap interval (§D7)."""

from __future__ import annotations

from curalina_recommendation.evaluation.metrics import (
    bootstrap_mean_interval,
    ndcg_at_k,
    precision_at_k,
    prevalence_baseline,
    shuffled_labels,
    supplier_proxy_gap,
)


def test_prevalence_baseline_analytic_expectation_equals_r_union() -> None:
    # 4 positives (grade >= 1) out of 10 -> r_union = 0.4
    labelled = [(f"p{i}", 1 if i < 4 else 0) for i in range(10)]

    baseline = prevalence_baseline(labelled)

    assert baseline.analytic_expected_p_at_5 == 0.4


def test_prevalence_baseline_observed_no_op_uses_source_order_top_5() -> None:
    labelled = [("p0", 1), ("p1", 1), ("p2", 0), ("p3", 0), ("p4", 0), ("p5", 1)]

    baseline = prevalence_baseline(labelled)

    # Top 5 in source order: p0..p4 -> 2 positives / 5
    assert baseline.observed_no_op_p_at_5 == precision_at_k([1, 1, 0, 0, 0])


def test_supplier_proxy_guard_inert_for_homogeneous_pool() -> None:
    pool = ["Four Hands"] * 10
    positives = ["Four Hands"] * 3

    gap = supplier_proxy_gap(positives, pool, four_hands_label="Four Hands")

    assert gap is None


def test_supplier_proxy_guard_detects_skew_in_mixed_pool() -> None:
    # Pool is 50/50 but every positive is Four Hands -> gap = 0.5
    pool = ["Four Hands"] * 5 + ["Moes Home"] * 5
    positives = ["Four Hands"] * 4

    gap = supplier_proxy_gap(positives, pool, four_hands_label="Four Hands")

    assert gap == 0.5


def test_supplier_proxy_guard_zero_when_positives_match_pool_composition() -> None:
    pool = ["Four Hands"] * 8 + ["Moes Home"] * 2
    positives = ["Four Hands"] * 4 + ["Moes Home"]

    gap = supplier_proxy_gap(positives, pool, four_hands_label="Four Hands")

    assert gap is not None
    assert round(gap, 4) == round(abs(0.8 - 0.8), 4)


# --- precision_at_k edge cases -----------------------------------------


def test_precision_at_k_empty_result_list_is_zero() -> None:
    assert precision_at_k([]) == 0.0


def test_precision_at_k_fewer_than_k_results_uses_actual_length() -> None:
    # Only 2 results supplied (k defaults to 5); denominator must be 2, not 5.
    assert precision_at_k([1, 0]) == 0.5


def test_precision_at_k_all_zero_relevances() -> None:
    assert precision_at_k([0, 0, 0, 0, 0]) == 0.0


def test_precision_at_k_all_max_relevances() -> None:
    assert precision_at_k([2, 2, 2, 2, 2]) == 1.0


# --- ndcg_at_k edge cases -------------------------------------------------


def test_ndcg_at_k_empty_result_list_with_relevant_items_in_brief() -> None:
    # No ranked results at all, but the brief does have a relevant item
    # elsewhere -> idcg > 0, dcg of an empty ranking is 0.
    result = ndcg_at_k([], all_relevances_for_brief=[1, 0, 0])

    assert result == 0.0


def test_ndcg_at_k_undefined_when_no_relevant_item_anywhere_in_brief() -> None:
    # All-zero relevances across the whole brief -> idcg == 0 -> undefined.
    result = ndcg_at_k([0, 0, 0], all_relevances_for_brief=[0, 0, 0, 0])

    assert result is None


def test_ndcg_at_k_fewer_than_k_results() -> None:
    # Only 2 ranked results returned; ideal is still computed over the
    # full brief's relevances, truncated to k.
    result = ndcg_at_k([1, 0], all_relevances_for_brief=[1, 1, 0])

    assert result is not None
    assert 0.0 < result < 1.0


def test_ndcg_at_k_perfect_ranking_of_all_max_relevances_is_one() -> None:
    result = ndcg_at_k([2, 2, 2], all_relevances_for_brief=[2, 2, 2])

    assert result == 1.0


# --- shuffled_labels --------------------------------------------------


def test_shuffled_labels_is_not_a_no_op() -> None:
    product_ids = [f"p{i}" for i in range(20)]
    grades = list(range(20))

    shuffled = shuffled_labels(product_ids, grades, seed=1)

    # With 20 distinct grades, an identity permutation is astronomically
    # unlikely; assert the shuffle actually moved at least one label.
    assert any(
        shuffled[pid] != grade
        for pid, grade in zip(product_ids, grades, strict=True)
    )
    # Multiset of labels is preserved -- it's a permutation, not a resample.
    assert sorted(shuffled.values()) == sorted(grades)


def test_shuffled_labels_is_deterministic_given_fixed_seed() -> None:
    product_ids = [f"p{i}" for i in range(10)]
    grades = [0, 1, 0, 1, 1, 0, 0, 1, 0, 1]

    first = shuffled_labels(product_ids, grades, seed=42)
    second = shuffled_labels(product_ids, grades, seed=42)

    assert first == second


def test_shuffled_labels_different_seeds_can_differ() -> None:
    product_ids = [f"p{i}" for i in range(20)]
    grades = list(range(20))

    a = shuffled_labels(product_ids, grades, seed=1)
    b = shuffled_labels(product_ids, grades, seed=2)

    assert a != b


# --- supplier_proxy_gap threshold branches -----------------------------


def test_supplier_proxy_guard_none_when_pool_is_empty() -> None:
    gap = supplier_proxy_gap([], [], four_hands_label="Four Hands")

    assert gap is None


def test_supplier_proxy_guard_inert_when_minority_share_below_floor() -> None:
    # Pool is 90/10 Four Hands/Moes -> minority share 0.10 < 0.15 floor,
    # guard is inert regardless of positive composition.
    pool = ["Four Hands"] * 9 + ["Moes Home"] * 1
    positives = ["Four Hands"] * 5

    gap = supplier_proxy_gap(positives, pool, four_hands_label="Four Hands")

    assert gap is None


def test_supplier_proxy_guard_none_when_no_positives_in_mixed_pool() -> None:
    # Pool is mixed enough to clear the floor, but there are zero labelled
    # positives to compare against -> nothing to compute a gap from.
    pool = ["Four Hands"] * 5 + ["Moes Home"] * 5

    gap = supplier_proxy_gap([], pool, four_hands_label="Four Hands")

    assert gap is None


def test_supplier_proxy_guard_passes_within_tolerance() -> None:
    # Pool is 60/40; positives are close enough (55/45) that the gap is
    # within the 0.15 tolerance the guard is checked against downstream.
    pool = ["Four Hands"] * 6 + ["Moes Home"] * 4
    positives = ["Four Hands"] * 11 + ["Moes Home"] * 9

    gap = supplier_proxy_gap(positives, pool, four_hands_label="Four Hands")

    assert gap is not None
    assert gap <= 0.15


def test_supplier_proxy_guard_fails_outside_tolerance() -> None:
    # Pool is 50/50; every positive is Four Hands -> gap of 0.5, well
    # outside the 0.15 tolerance.
    pool = ["Four Hands"] * 5 + ["Moes Home"] * 5
    positives = ["Four Hands"] * 4

    gap = supplier_proxy_gap(positives, pool, four_hands_label="Four Hands")

    assert gap is not None
    assert gap > 0.15


# --- bootstrap_mean_interval --------------------------------------------


def test_bootstrap_mean_interval_empty_values_returns_zeros() -> None:
    assert bootstrap_mean_interval([], seed=0) == (0.0, 0.0, 0.0)


def test_bootstrap_mean_interval_single_value_returns_degenerate_interval() -> None:
    result = bootstrap_mean_interval([0.4], seed=0)

    assert result == (0.4, 0.4, 0.4)


def test_bootstrap_mean_interval_point_estimate_is_the_mean() -> None:
    values = [0.2, 0.4, 0.6, 0.8]

    point, lo, hi = bootstrap_mean_interval(values, seed=7, n_resamples=500)

    assert point == sum(values) / len(values)
    assert lo <= point <= hi


def test_bootstrap_mean_interval_is_deterministic_given_fixed_seed() -> None:
    values = [0.1, 0.5, 0.9, 0.3, 0.7]

    first = bootstrap_mean_interval(values, seed=99, n_resamples=200)
    second = bootstrap_mean_interval(values, seed=99, n_resamples=200)

    assert first == second
