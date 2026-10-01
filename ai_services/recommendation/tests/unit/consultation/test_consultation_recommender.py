"""Room-building logic, with a fake scorer so scores are chosen by the test."""

from collections.abc import Sequence
from dataclasses import replace

import numpy as np

from curalina_recommendation.consultation.catalogue import (
    Catalogue,
    CatalogueProduct,
    CatalogueReport,
)
from curalina_recommendation.consultation.model import ModelInfo
from curalina_recommendation.consultation.quiz import ConsultationAnswers, Query
from curalina_recommendation.consultation.recommender import (
    ConsultationRecommender,
    NeedsInput,
    Recommendation,
    matches_rule,
)

INFO = ModelInfo("consultation-two-tower", "f" * 64, "run_test", {})


def _product(
    pid: str, category: str, price: float | None, **kw: object
) -> CatalogueProduct:
    base: dict[str, object] = {
        "product_id": pid,
        "supplier": "Luxus",
        "sku": None,
        "name": pid,
        "category": category,
        "price": price,
        "rooms": ("Bedroom", "Dining Room", "Living Room"),
        "styles": ("Organic Modern",),
        "atmospheres": ("Bright & Airy",),
        "touches": (),
        "seating": None,
        "bed_size": None,
        "width_in": None,
        "depth_in": None,
        "height_in": None,
        "overview": None,
    }
    base.update(kw)
    return CatalogueProduct(**base)  # type: ignore[arg-type]


class FakeScorer:
    def __init__(self, scores: dict[str, float]) -> None:
        self._scores = scores
        self.info = INFO
        self._products: list[CatalogueProduct] = []

    def encode_products(self, products: Sequence[CatalogueProduct]) -> np.ndarray:
        self._products = list(products)
        return np.arange(len(products), dtype=np.float32)[:, None]

    def score(self, query: Query, matrix: np.ndarray) -> np.ndarray:
        return np.asarray([self._scores.get(p.product_id, 0.0) for p in self._products])


def _recommender(
    products: list[CatalogueProduct], scores: dict[str, float]
) -> ConsultationRecommender:
    catalogue = Catalogue(tuple(products), CatalogueReport(fingerprint="a" * 64))
    return ConsultationRecommender(catalogue, FakeScorer(scores))  # type: ignore[arg-type]


def _answers(**overrides: object) -> ConsultationAnswers:
    base: dict[str, object] = {
        "room_type": "Bedroom",
        "aesthetic": "Organic Modern",
        "materiality": "Organic Modern",
        "atmosphere": "Bright & Airy",
        "pattern_preference": "Just Solids",
        "practical_touches": ("Cozy, relaxing space for everyday comfort",),
        "seating_capacity": None,
        "bed_size": None,
        "investment": "$20,000-$30,000",
    }
    base.update(overrides)
    return ConsultationAnswers(**base)  # type: ignore[arg-type]


def _ok(result: Recommendation | NeedsInput) -> Recommendation:
    assert isinstance(result, Recommendation)
    return result


BEDROOM = [
    _product("bed_top", "Bed", 9000.0),
    _product("bed_cheap", "Bed", 4000.0),
    _product("stand", "Nightstand", 600.0),
    _product("bench_unpriced", "Bench", None),
    _product("art", "Wall Art", 700.0, supplier="Celadon", sku="21076"),
]


def test_invalid_answers_return_needs_input() -> None:
    result = _recommender(BEDROOM, {}).recommend(_answers(atmosphere=None))
    assert isinstance(result, NeedsInput)
    assert "atmosphere: missing" in result.problems


def test_bedroom_is_built_from_the_manual_slots_best_first() -> None:
    scores = {
        "bed_top": 0.95,
        "bed_cheap": 0.9,
        "stand": 0.9,
        "bench_unpriced": 0.99,
        "art": 0.8,
    }
    result = _ok(_recommender(BEDROOM, scores).recommend(_answers()))
    placed = {p.slot_id: p for p in result.placements}
    assert placed["bedroom_bed"].scored.product.product_id == "bed_top"
    stands = placed["bedroom_nightstands"]
    assert stands.quantity == 2 and stands.line_total == 1200.0
    assert "bedroom_bench" not in placed
    assert any("Bench" in n and "usable price" in n for n in result.notes)
    assert placed["bedroom_art"].tier == "accent"
    assert result.total == 9000.0 + 1200.0 + 700.0
    assert result.ceiling == 30000.0
    assert [a.product.product_id for a in result.alternatives["bedroom_bed"]] == [
        "bed_cheap"
    ]
    assert result.plan_source.startswith("Design Manual §4.2")


def test_budget_skips_to_a_cheaper_match() -> None:
    scores = {"bed_top": 0.95, "bed_cheap": 0.9, "stand": 0.9, "art": 0.8}
    result = _ok(
        _recommender(BEDROOM, scores).recommend(_answers(investment="$20,000-$30,000"))
    )
    tight = _recommender(
        [replace(BEDROOM[0], price=31_000.0), *BEDROOM[1:]], scores
    ).recommend(_answers())
    assert _ok(tight).placements[0].scored.product.product_id == "bed_cheap"
    assert result.placements[0].scored.product.product_id == "bed_top"


def test_low_scores_are_not_placed() -> None:
    result = _ok(_recommender(BEDROOM, {"bed_top": 0.4}).recommend(_answers()))
    assert result.placements == ()
    assert any("no product scores at least 0.5" in n for n in result.notes)


def test_open_top_band_has_no_ceiling() -> None:
    result = _ok(
        _recommender(BEDROOM, {"bed_top": 0.9}).recommend(
            _answers(investment="$66,000+")
        )
    )
    assert result.ceiling is None
    assert any("no upper bound" in n for n in result.notes)


def test_dining_chairs_follow_seating_then_table() -> None:
    products = [
        _product("table", "Dining Table", 10000.0, seating=10),
        _product("chair", "Dining Chair", 1000.0),
    ]
    scores = {"table": 0.9, "chair": 0.9}
    answers = _answers(room_type="Dining Room", investment="$31,000-$40,000")
    with_answer = _ok(
        _recommender(products, scores).recommend(replace(answers, seating_capacity=8))
    )
    from_table = _ok(_recommender(products, scores).recommend(answers))
    assert with_answer.placements[1].quantity == 8
    assert from_table.placements[1].quantity == 10
    assert from_table.placements[1].quantity_source == "chosen table's seating"


def test_living_room_falls_back_to_a_credenza_only_without_a_sofa() -> None:
    products = [_product("credenza", "Sideboard", 5000.0)]
    answers = _answers(
        room_type="Living Room", practical_touches=("Pet friendly and durable fabrics",)
    )
    result = _ok(_recommender(products, {"credenza": 0.9}).recommend(answers))
    assert result.placements[0].scored.product.category == "Sideboard"
    assert any("anchors the room" in n for n in result.notes)
    with_sofa = _ok(
        _recommender(
            [*products, _product("sofa", "Sofa", 6000.0)],
            {"credenza": 0.95, "sofa": 0.6},
        ).recommend(answers)
    )
    assert with_sofa.placements[0].scored.product.product_id == "sofa"


def test_rule_match_mirrors_the_training_label() -> None:
    q = Query(
        "Dining Room",
        "Contemporary Luxe",
        "Organic Modern",
        "Bright & Airy",
        ("Refined space for hosting and socializing",),
        8,
        None,
    )
    table = _product(
        "t",
        "Dining Table",
        1.0,
        seating=12,
        touches=("Refined space for hosting and socializing",),
    )
    assert not matches_rule(q, table)  # seating disagrees
    assert matches_rule(q, replace(table, seating=8))  # materiality style matches
    assert not matches_rule(q, replace(table, seating=8, atmospheres=("Dark & Moody",)))
