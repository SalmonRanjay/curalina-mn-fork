"""The service reproduces the notebook on the real supplier workbooks.

Runs only when `CURALINA_SUPPLIER_DATA_DIR` points at the "Supplier CSV
Files" folder: fast tests never read customer data. Compares every product's
score for the notebook's two demo answer sets (`model/parity.json`), which
exercises catalogue loading, IDs, feature encoding and the forward pass end
to end.
"""

import json
import os
from importlib import resources
from pathlib import Path
from typing import Any

import pytest

from curalina_recommendation.consultation.catalogue import load_catalogue
from curalina_recommendation.consultation.model import TwoTowerScorer
from curalina_recommendation.consultation.quiz import ConsultationAnswers, to_query
from curalina_recommendation.consultation.recommender import (
    ConsultationRecommender,
    Recommendation,
)

DATA_DIR = os.environ.get("CURALINA_SUPPLIER_DATA_DIR")
pytestmark = pytest.mark.skipif(
    not DATA_DIR, reason="CURALINA_SUPPLIER_DATA_DIR not set"
)


def _notebook_answers(a: dict[str, Any]) -> ConsultationAnswers:
    return ConsultationAnswers(
        room_type=a["roomType"],
        aesthetic=a["aesthetic"],
        materiality=a["materiality"],
        atmosphere=a["atmosphere"],
        pattern_preference=a["patternPreference"],
        practical_touches=tuple(a["keyFeatures"]),
        seating_capacity=a.get("seatingCapacity"),
        bed_size=a.get("bedSize") or None,
        investment=a["investment"],
    )


def _demo() -> list[dict[str, Any]]:
    text = (
        resources.files("curalina_recommendation.consultation")
        .joinpath("model/parity.json")
        .read_text(encoding="utf-8")
    )
    return json.loads(text)["demo_answers"]  # type: ignore[no-any-return]


def test_scores_match_the_notebook_for_every_product() -> None:
    catalogue = load_catalogue(Path(str(DATA_DIR)))
    scorer = TwoTowerScorer.load()
    matrix = scorer.encode_products(catalogue.products)
    for demo in _demo():
        expected: dict[str, float] = demo["scores"]
        ids = [p.product_id for p in catalogue.products]
        assert ids == list(expected), (
            "catalogue rows or product IDs differ from training"
        )
        scores = scorer.score(to_query(_notebook_answers(demo["answers"])), matrix)
        mismatched = [
            (pid, round(float(s), 4), round(expected[pid], 4))
            for pid, s in zip(ids, scores, strict=True)
            if abs(float(s) - expected[pid]) > 1e-4
        ]
        assert not mismatched, mismatched[:10]


def test_demo_bedroom_places_only_rule_consistent_pieces() -> None:
    recommender = ConsultationRecommender(
        load_catalogue(Path(str(DATA_DIR))), TwoTowerScorer.load()
    )
    result = recommender.recommend(_notebook_answers(_demo()[0]["answers"]))
    assert isinstance(result, Recommendation)
    assert {p.slot_id for p in result.placements} >= {
        "bedroom_bed",
        "bedroom_nightstands",
    }
    assert all(p.scored.rule_match for p in result.placements)
    assert result.total <= 30000
