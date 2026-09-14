"""Arm-execution orchestration with fake/stub encoders (no sklearn/
sentence-transformers import) — including ADR-0006 §D7's requirement that
a `not_run` result for one arm never corrupts or blocks another arm's
result for the same brief."""

from __future__ import annotations

from decimal import Decimal
from pathlib import Path

import openpyxl

from curalina_recommendation.domain.eligibility import Availability, EligibilityReason
from curalina_recommendation.domain.money import Money
from curalina_recommendation.domain.product import Product, ProductKey
from curalina_recommendation.domain.profile import Profile
from curalina_recommendation.domain.ranking import RankedCandidate
from curalina_recommendation.evaluation.candidates import CandidateSet
from curalina_recommendation.evaluation.label_rules import Brief
from curalina_recommendation.evaluation.run_arms import (
    evaluate_arm,
    load_products,
    not_run_result,
    prevalence_arm,
    profile_for_brief,
    supplier_proxy_guard_for_brief,
)


def _product(product_id: str, supplier: str = "Four Hands") -> Product:
    return Product(
        product_id=product_id,
        key=ProductKey.build(supplier_id=supplier, raw_sku=product_id),
        category="Dining Chairs",
        name=product_id,
        availability=Availability.UNKNOWN,
    )


def _brief(**overrides: object) -> Brief:
    defaults: dict[str, object] = dict(
        brief_id="A1-1",
        stratum="A",
        room_type="Dining room",
        categories=("Dining Chairs",),
    )
    defaults.update(overrides)
    return Brief(**defaults)  # type: ignore[arg-type]


def _candidate_set(brief_id: str = "A1-1") -> CandidateSet:
    products = (_product("p1"), _product("p2"), _product("p3", "Moes Home"))
    return CandidateSet(
        brief_id=brief_id,
        products=products,
        labels={"p1": 2, "p2": 0, "p3": 1},
        suppliers={"p1": "Four Hands", "p2": "Four Hands", "p3": "Moes Home"},
        unmapped_count=0,
        unmapped_rate=0.0,
        partial_normalization_count=0,
        layer1_excluded_count=0,
        total_precondition_eligible=3,
    )


class _FakeEncoder:
    """Ranks by reversing product order, deterministically — never touches
    sklearn/sentence-transformers."""

    def rank(
        self, products: tuple[Product, ...], profile: Profile
    ) -> tuple[RankedCandidate, ...]:
        return tuple(
            RankedCandidate(
                product_id=p.product_id,
                category=p.category,
                score=1.0,
                reasons=(EligibilityReason.CATEGORY_MATCH,),
            )
            for p in reversed(products)
        )


class _ExplodingEncoder:
    def rank(
        self, products: tuple[Product, ...], profile: Profile
    ) -> tuple[RankedCandidate, ...]:
        raise AssertionError("not_run arms must never construct/invoke an encoder")


def test_not_run_result_records_reason_and_candidate_counts_without_an_encoder() -> (
    None
):
    candidate_set = _candidate_set()
    brief = _brief()

    result = not_run_result(
        "tfidf", brief, candidate_set, "no_network_or_missing_extra"
    )

    assert result.status == "not_run"
    assert result.not_run_reason == "no_network_or_missing_extra"
    assert result.arm == "tfidf"
    assert result.brief_id == "A1-1"
    assert result.n_labelled_candidates == 3
    assert result.n_positive == 2  # p1 (grade 2), p3 (grade 1)
    assert result.precision_at_5 is None
    assert result.ndcg_at_5 is None
    assert result.shuffled_precision_at_5 is None
    assert result.per_supplier_precision_at_5 == {}


def test_evaluate_arm_computes_precision_and_ndcg_with_a_stub_encoder() -> None:
    candidate_set = _candidate_set()
    brief = _brief()

    result = evaluate_arm(
        "rule_only", _FakeEncoder(), brief, candidate_set, shuffle_seed=0
    )

    assert result.status == "ok"
    assert result.not_run_reason is None
    # Ranked order (reversed): p3(1), p2(0), p1(2) -> relevant (>=1): p3, p1 => 2/3
    assert result.precision_at_5 == 2 / 3
    assert result.ndcg_at_5 is not None
    assert result.n_labelled_candidates == 3
    assert result.n_positive == 2


def test_evaluate_arm_reports_per_supplier_precision_separately() -> None:
    candidate_set = _candidate_set()
    brief = _brief()

    result = evaluate_arm(
        "rule_only", _FakeEncoder(), brief, candidate_set, shuffle_seed=0
    )

    assert set(result.per_supplier_precision_at_5) == {"Four Hands", "Moes Home"}
    # Four Hands candidates: p1 (grade 2), p2 (grade 0) -> 1/2 relevant.
    assert result.per_supplier_precision_at_5["Four Hands"] == 1 / 2
    # Moe's Home candidates: p3 (grade 1) -> 1/1 relevant.
    assert result.per_supplier_precision_at_5["Moes Home"] == 1.0


def test_a_not_run_arm_does_not_corrupt_or_block_an_ok_arm_for_the_same_brief() -> None:
    """ADR-0006 §D7: a `not_run` arm (e.g. TfidfEncoder with no `eval`
    extra) must never affect another arm's computed result for the same
    brief/candidate set."""

    candidate_set = _candidate_set()
    brief = _brief()

    # Compute the "ok" arm's result once, standalone.
    baseline = evaluate_arm(
        "rule_only", _FakeEncoder(), brief, candidate_set, shuffle_seed=0
    )

    # Now compute a not_run result for a different arm first, then the
    # "ok" arm again over the exact same (brief, candidate_set) inputs.
    not_run = not_run_result(
        "tfidf", brief, candidate_set, "no_network_or_missing_extra"
    )
    after = evaluate_arm(
        "rule_only", _FakeEncoder(), brief, candidate_set, shuffle_seed=0
    )

    assert not_run.status == "not_run"
    assert after == baseline


def test_multiple_not_run_arms_do_not_prevent_the_ok_arm_from_producing_metrics() -> (
    None
):
    candidate_set = _candidate_set()
    brief = _brief()

    results = [
        not_run_result("tfidf", brief, candidate_set, "no_network_or_missing_extra"),
        not_run_result(
            "minilm", brief, candidate_set, "sentence-transformers is not installed"
        ),
        evaluate_arm("rule_only", _FakeEncoder(), brief, candidate_set, shuffle_seed=0),
    ]

    statuses = {r.arm: r.status for r in results}
    assert statuses == {"tfidf": "not_run", "minilm": "not_run", "rule_only": "ok"}

    ok_result = next(r for r in results if r.arm == "rule_only")
    assert ok_result.precision_at_5 is not None
    assert ok_result.ndcg_at_5 is not None

    # never a loss: not_run arms carry no precision/ndcg value at all.
    for r in results:
        if r.status == "not_run":
            assert r.precision_at_5 is None
            assert r.ndcg_at_5 is None


def test_not_run_arm_never_constructs_or_invokes_an_encoder() -> None:
    # not_run_result's signature takes no encoder at all, but this pins
    # the intent explicitly: an exploding encoder object sitting nearby
    # (as it would in a real run-arms loop) must never be reached for the
    # not_run branch.
    candidate_set = _candidate_set()
    brief = _brief()
    exploding = _ExplodingEncoder()

    result = not_run_result(
        "tfidf", brief, candidate_set, "no_network_or_missing_extra"
    )

    assert result.status == "not_run"
    # The exploding encoder is never touched by the not_run path.
    del exploding


def test_prevalence_arm_matches_the_metrics_module_formula() -> None:
    candidate_set = _candidate_set()

    baseline = prevalence_arm(candidate_set)

    # 2 of 3 labelled products have grade >= 1 -> r_union = 2/3.
    assert baseline.analytic_expected_p_at_5 == 2 / 3


def test_supplier_proxy_guard_for_brief_delegates_to_metrics_supplier_proxy_gap() -> (
    None
):
    candidate_set = _candidate_set()

    gap = supplier_proxy_guard_for_brief(candidate_set)

    # Pool is 2/3 Four Hands; minority share (1/3 Moe's) is < 0.15? No:
    # 1/3 ~= 0.333 >= 0.15, so the guard is active. Positives: p1 (FH),
    # p3 (Moe's) -> 1/2 FH among positives vs 2/3 FH in the pool.
    assert gap is not None
    assert gap == abs(0.5 - (2 / 3))


def test_profile_for_brief_uses_the_brief_budget_when_present() -> None:
    brief = _brief(budget_max=Decimal("500"))

    profile = profile_for_brief(brief)

    assert profile.budget == Money(Decimal("500"), "XXX")
    assert profile.room_type == "Dining room"
    assert profile.categories == ("Dining Chairs",)


def test_profile_for_brief_uses_a_large_placeholder_budget_when_brief_has_none() -> (
    None
):
    brief = _brief()

    profile = profile_for_brief(brief)

    assert profile.budget.amount == Decimal("999999")


def test_profile_for_brief_defaults_style_and_atmosphere_to_unspecified() -> None:
    brief = _brief()

    profile = profile_for_brief(brief)

    assert profile.style == "unspecified"
    assert profile.atmosphere == "unspecified"


_HEADER = [f"col{i}" for i in range(36)]


def _catalogue_row(*, supplier: str, sku: str) -> list[object]:
    row: list[object] = [None] * 36
    row[0] = f"Product {sku}"
    row[2] = supplier
    row[3] = sku
    row[5] = 100
    row[6] = "Sofa"
    row[29] = '30"w x 20"d x 40"h'
    row[27] = (
        "Four Hands Sofas.xlsx" if supplier == "Four Hands" else "Moes Home Sofas.xlsx"
    )
    return row


def _write_catalogue_workbook(tmp_path: Path) -> Path:
    workbook = openpyxl.Workbook()
    sheet = workbook.active
    sheet.append(_HEADER)
    sheet.append(_catalogue_row(supplier="Four Hands", sku="FH-1"))
    sheet.append(_catalogue_row(supplier="Moes Home", sku="MH-1"))
    path = tmp_path / "workbook.xlsx"
    workbook.save(path)
    return path


def test_load_products_merges_both_suppliers_into_one_product_id_keyed_dict(
    tmp_path: Path,
) -> None:
    path = _write_catalogue_workbook(tmp_path)

    products = load_products(str(path))

    supplier_ids = {p.key.supplier_id for p in products.values()}
    assert supplier_ids == {"Four Hands", "Moes Home"}
    assert len(products) == 2
    for product_id, product in products.items():
        assert product.product_id == product_id
