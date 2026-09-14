"""Layer-1 eligibility filtering and candidate-set assembly, against
synthetic known eligible/ineligible products."""

from __future__ import annotations

from decimal import Decimal

from curalina_recommendation.domain.eligibility import Availability
from curalina_recommendation.domain.money import Money
from curalina_recommendation.domain.product import Product, ProductKey
from curalina_recommendation.evaluation.candidates import build_candidate_set
from curalina_recommendation.evaluation.label_rules import Brief, LabelResult
from curalina_recommendation.evaluation.label_source import LabelSourceRecord


def _product(product_id: str, price: str = "100.00") -> Product:
    return Product(
        product_id=product_id,
        key=ProductKey.build(supplier_id="Four Hands", raw_sku=product_id),
        category="Dining Chairs",
        name=product_id,
        availability=Availability.UNKNOWN,
        price=Money(Decimal(price), "USD"),
    )


def _record(
    product_id: str, *, price: str | None = "100.00", width_in: str | None = None
) -> LabelSourceRecord:
    return LabelSourceRecord(
        product_id=product_id,
        supplier_id="Four Hands",
        price=Decimal(price) if price is not None else None,
        width_in=Decimal(width_in) if width_in is not None else None,
        room_types_raw=("Dining room",),
        design_styles_raw=(),
        tags_raw=(),
        categories_raw=("Dining Chairs",),
    )


def _result(
    product_id: str,
    *,
    precondition: bool = True,
    grade: int | None = 1,
    unmapped: bool = False,
    partial: bool = False,
) -> LabelResult:
    return LabelResult(
        product_id=product_id,
        supplier_id="Four Hands",
        precondition=precondition,
        grade=grade,
        unmapped=unmapped,
        partial_normalization=partial,
    )


def _brief(**overrides: object) -> Brief:
    defaults: dict[str, object] = dict(
        brief_id="B1",
        stratum="B",
        room_type="Dining room",
        categories=("Dining Chairs",),
    )
    defaults.update(overrides)
    return Brief(**defaults)  # type: ignore[arg-type]


def test_product_within_budget_is_eligible() -> None:
    brief = _brief(budget_max=Decimal("150"))
    record = _record("p1", price="100.00")
    products = {"p1": _product("p1")}

    candidate_set = build_candidate_set(brief, products, (record,), [_result("p1")])

    assert "p1" in candidate_set.labels
    assert candidate_set.layer1_excluded_count == 0


def test_product_over_budget_is_layer1_excluded() -> None:
    brief = _brief(budget_max=Decimal("50"))
    record = _record("p1", price="100.00")
    products = {"p1": _product("p1")}

    candidate_set = build_candidate_set(brief, products, (record,), [_result("p1")])

    assert "p1" not in candidate_set.labels
    assert candidate_set.layer1_excluded_count == 1
    assert candidate_set.products == ()


def test_product_missing_price_with_a_budget_brief_is_layer1_excluded() -> None:
    brief = _brief(budget_max=Decimal("50"))
    record = _record("p1", price=None)
    products = {"p1": _product("p1")}

    candidate_set = build_candidate_set(brief, products, (record,), [_result("p1")])

    assert "p1" not in candidate_set.labels
    assert candidate_set.layer1_excluded_count == 1


def test_product_within_dimension_ceiling_is_eligible() -> None:
    brief = _brief(max_dimension_in=Decimal("36"))
    record = _record("p1", width_in="30")
    products = {"p1": _product("p1")}

    candidate_set = build_candidate_set(brief, products, (record,), [_result("p1")])

    assert "p1" in candidate_set.labels


def test_product_over_dimension_ceiling_is_layer1_excluded() -> None:
    brief = _brief(max_dimension_in=Decimal("36"))
    record = _record("p1", width_in="40")
    products = {"p1": _product("p1")}

    candidate_set = build_candidate_set(brief, products, (record,), [_result("p1")])

    assert "p1" not in candidate_set.labels
    assert candidate_set.layer1_excluded_count == 1


def test_product_missing_dimensions_with_a_dimension_brief_is_layer1_excluded() -> None:
    brief = _brief(max_dimension_in=Decimal("36"))
    record = _record("p1", width_in=None)
    products = {"p1": _product("p1")}

    candidate_set = build_candidate_set(brief, products, (record,), [_result("p1")])

    assert "p1" not in candidate_set.labels
    assert candidate_set.layer1_excluded_count == 1


def test_product_failing_precondition_is_excluded_before_layer1_and_not_counted() -> (
    None
):
    brief = _brief()
    record = _record("p1")
    products = {"p1": _product("p1")}
    result = _result("p1", precondition=False, grade=0)

    candidate_set = build_candidate_set(brief, products, (record,), [result])

    assert "p1" not in candidate_set.labels
    assert candidate_set.layer1_excluded_count == 0
    assert candidate_set.total_precondition_eligible == 0


def test_unmapped_product_is_excluded_from_candidate_set_and_counted_separately() -> (
    None
):
    brief = _brief(style="Modern Farmhouse", atmosphere="Warm Neutrals")
    record = _record("p1")
    products = {"p1": _product("p1")}
    result = _result("p1", grade=None, unmapped=True)

    candidate_set = build_candidate_set(brief, products, (record,), [result])

    assert "p1" not in candidate_set.labels
    assert candidate_set.unmapped_count == 1
    assert candidate_set.unmapped_rate == 1.0
    assert candidate_set.layer1_excluded_count == 0


def test_unmapped_rate_is_computed_over_precondition_eligible_only() -> None:
    brief = _brief(style="Modern Farmhouse", atmosphere="Warm Neutrals")
    records = (_record("p1"), _record("p2"), _record("p3"), _record("p4"))
    products = {pid: _product(pid) for pid in ("p1", "p2", "p3", "p4")}
    results = [
        _result("p1", grade=1),
        _result("p2", grade=None, unmapped=True),
        _result("p3", grade=0),
        _result("p4", precondition=False, grade=0),
    ]

    candidate_set = build_candidate_set(brief, products, records, results)

    # p4 never entered the precondition-eligible pool at all.
    assert candidate_set.total_precondition_eligible == 3
    assert candidate_set.unmapped_count == 1
    assert candidate_set.unmapped_rate == 1 / 3


def test_partial_normalization_count_is_tracked_but_still_labelled() -> None:
    brief = _brief()
    record = _record("p1")
    products = {"p1": _product("p1")}
    result = _result("p1", grade=1, partial=True)

    candidate_set = build_candidate_set(brief, products, (record,), [result])

    assert "p1" in candidate_set.labels
    assert candidate_set.partial_normalization_count == 1


def test_labels_and_suppliers_dicts_only_contain_labelled_candidates() -> None:
    brief = _brief()
    records = (_record("p1"), _record("p2"))
    products = {"p1": _product("p1"), "p2": _product("p2")}
    results = [_result("p1", grade=2), _result("p2", grade=None, unmapped=True)]

    candidate_set = build_candidate_set(brief, products, records, results)

    assert candidate_set.labels == {"p1": 2}
    assert candidate_set.suppliers == {"p1": "Four Hands"}
    assert len(candidate_set.products) == 1
    assert candidate_set.products[0].product_id == "p1"


def test_product_missing_from_products_lookup_is_dropped_from_labelled_set() -> None:
    brief = _brief()
    record = _record("p1")
    # p1 is a valid label result but absent from the products lookup
    # (e.g. filtered out earlier by the importer) -> must not KeyError.
    candidate_set = build_candidate_set(brief, {}, (record,), [_result("p1", grade=1)])

    assert candidate_set.labels == {}
    assert candidate_set.products == ()


def test_zero_precondition_eligible_products_yields_zero_unmapped_rate() -> None:
    brief = _brief()

    candidate_set = build_candidate_set(brief, {}, (), [])

    assert candidate_set.total_precondition_eligible == 0
    assert candidate_set.unmapped_rate == 0.0
