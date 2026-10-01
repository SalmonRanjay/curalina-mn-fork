import json
from importlib import resources
from typing import get_args

import pytest

from curalina_recommendation.api import schemas
from curalina_recommendation.consultation import quiz
from curalina_recommendation.consultation.quiz import (
    ConsultationAnswers,
    investment_ceiling,
    to_query,
    validate,
)


def _answers(**overrides: object) -> ConsultationAnswers:
    base: dict[str, object] = {
        "room_type": "Bedroom",
        "aesthetic": "Organic Modern",
        "materiality": "Organic Modern",
        "atmosphere": "Bright & Airy",
        "pattern_preference": "Just Solids",
        "practical_touches": ("Refined space for hosting guests",),
        "seating_capacity": None,
        "bed_size": "King Size Bed",
        "investment": "$20,000-$30,000",
    }
    base.update(overrides)
    return ConsultationAnswers(**base)  # type: ignore[arg-type]


def test_quiz_matches_the_copy_the_model_was_trained_on() -> None:
    trained = json.loads(
        resources.files("curalina_recommendation.consultation")
        .joinpath("model/quiz_schema.json")
        .read_text(encoding="utf-8")
    )
    assert tuple(trained["rooms"]) == quiz.ROOMS
    assert tuple(trained["styles"]) == quiz.STYLES
    assert tuple(trained["atmospheres"]) == quiz.ATMOSPHERES
    assert tuple(trained["patterns"]) == quiz.PATTERNS
    assert {
        k: tuple(v) for k, v in trained["touches_by_room"].items()
    } == quiz.TOUCHES_BY_ROOM
    assert tuple(trained["seating_options"]) == quiz.SEATING_OPTIONS
    assert tuple(trained["bed_sizes"]) == quiz.BED_SIZES
    assert tuple(trained["investments"]) == quiz.INVESTMENTS


def test_wire_enums_match_the_quiz() -> None:
    assert get_args(schemas.ConsultationRoom) == quiz.ROOMS
    assert get_args(schemas.ConsultationStyle) == quiz.STYLES
    assert get_args(schemas.ConsultationAtmosphere) == quiz.ATMOSPHERES
    assert get_args(schemas.ConsultationPattern) == quiz.PATTERNS
    assert set(get_args(schemas.ConsultationTouch)) == {
        t for touches in quiz.TOUCHES_BY_ROOM.values() for t in touches
    }
    assert get_args(schemas.ConsultationSeating) == quiz.SEATING_OPTIONS
    assert get_args(schemas.ConsultationBedSize) == quiz.BED_SIZES
    assert get_args(schemas.ConsultationInvestment) == quiz.INVESTMENTS


def test_complete_answers_validate() -> None:
    assert validate(_answers()) == []


def test_missing_answers_are_reported_not_defaulted() -> None:
    problems = validate(
        _answers(atmosphere=None, investment=None, practical_touches=())
    )
    assert "atmosphere: missing" in problems
    assert "investment: missing" in problems
    assert any(p.startswith("practical_touches") for p in problems)


def test_touch_must_belong_to_the_room() -> None:
    problems = validate(
        _answers(
            room_type="Dining Room",
            bed_size=None,
            practical_touches=("Dedicated media area for television",),
        )
    )
    assert any("not options for Dining Room" in p for p in problems)


def test_room_scoped_questions_only_for_their_room() -> None:
    problems = validate(
        _answers(
            room_type="Living Room",
            bed_size="King Size Bed",
            seating_capacity=8,
            practical_touches=("Pet friendly and durable fabrics",),
        )
    )
    assert "seating_capacity: only asked for the Dining Room" in problems
    assert "bed_size: only asked for the Bedroom" in problems


def test_query_maps_bedroom_hosting_wording_to_catalogue_tag() -> None:
    q = to_query(_answers())
    assert q.touches == ("Refined space for hosting and socializing",)
    assert q.bed_size == "King Size Bed"


@pytest.mark.parametrize(
    ("band", "ceiling"),
    [("$20,000-$30,000", 30000), ("$51,000-$65,000", 65000), ("$66,000+", None)],
)
def test_investment_ceiling(band: str, ceiling: int | None) -> None:
    assert investment_ceiling(band) == ceiling


def test_investment_ceiling_rejects_unknown_band() -> None:
    with pytest.raises(ValueError):
        investment_ceiling("about 30k")
