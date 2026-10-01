"""The Consultation-1 quiz as recommendation sees it.

Option strings are the stored values from
`client/src/components/quiz/consultationOptions.ts` and must stay identical
to the copy the model was trained against (`model/quiz_schema.json`);
`tests/unit/consultation/test_quiz.py` asserts that.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

ROOMS: tuple[str, ...] = ("Living Room", "Dining Room", "Bedroom")
STYLES: tuple[str, ...] = (
    "Organic Modern",
    "Contemporary Luxe",
    "Mid-Century Scandinavian",
)
ATMOSPHERES: tuple[str, ...] = ("Bright & Airy", "Warm & Balanced", "Dark & Moody")
PATTERNS: tuple[str, ...] = ("Just Solids", "Patterned Accents", "Pattern Forward")
TOUCHES_BY_ROOM: dict[str, tuple[str, ...]] = {
    "Living Room": (
        "Cozy, relaxing space for everyday comfort",
        "Pet friendly and durable fabrics",
        "Refined space for hosting and socializing",
        "Dedicated media area for television",
        "Storage to keep everything tidy",
        "An architectural fireplace to anchor the room",
    ),
    "Dining Room": (
        "Cozy, relaxing space for everyday comfort",
        "Pet friendly and durable fabrics",
        "Refined space for hosting and socializing",
        "Storage to keep everything tidy",
    ),
    "Bedroom": (
        "Cozy, relaxing space for everyday comfort",
        "Pet friendly and durable fabrics",
        "Refined space for hosting guests",
        "Storage to keep everything tidy",
    ),
}
SEATING_OPTIONS: tuple[int, ...] = (4, 6, 8, 10, 12)
BED_SIZES: tuple[str, ...] = ("Double Size Bed", "Queen Size Bed", "King Size Bed")
INVESTMENTS: tuple[str, ...] = (
    "$20,000-$30,000",
    "$31,000-$40,000",
    "$41,000-$50,000",
    "$51,000-$65,000",
    "$66,000+",
)

# Owner-accepted assumption carried over from the notebook (STATUS session 22,
# awaiting client confirmation): the Bedroom wording is the same catalogue tag.
QUIZ_TOUCH_TO_CATALOGUE: dict[str, str] = {
    "Refined space for hosting guests": "Refined space for hosting and socializing"
}


def catalogue_touch(touch: str) -> str:
    return QUIZ_TOUCH_TO_CATALOGUE.get(touch, touch)


@dataclass(frozen=True, slots=True)
class ConsultationAnswers:
    """One quiz submission, as the app stores it. `None` = not answered."""

    room_type: str | None
    aesthetic: str | None
    materiality: str | None
    atmosphere: str | None
    pattern_preference: str | None
    practical_touches: tuple[str, ...]
    seating_capacity: int | None
    bed_size: str | None
    investment: str | None


@dataclass(frozen=True, slots=True)
class Query:
    """Model-side view of the answers (touches already in catalogue wording)."""

    room: str
    aesthetic: str
    materiality: str
    atmosphere: str
    touches: tuple[str, ...]
    seating: int | None
    bed_size: str | None


def validate(answers: ConsultationAnswers) -> list[str]:
    """Every problem with a submission; empty when it can be scored.

    Missing answers are reported, never defaulted. Out-of-vocabulary values
    are rejected at the HTTP layer (422) before reaching this function, so
    the checks here are about combinations the enums cannot express.
    """
    problems: list[str] = []
    for field, value in (
        ("room_type", answers.room_type),
        ("aesthetic", answers.aesthetic),
        ("materiality", answers.materiality),
        ("atmosphere", answers.atmosphere),
        ("pattern_preference", answers.pattern_preference),
        ("investment", answers.investment),
    ):
        if not value:
            problems.append(f"{field}: missing")
    room = answers.room_type
    if not answers.practical_touches:
        problems.append("practical_touches: choose at least one practical touch")
    elif room in TOUCHES_BY_ROOM:
        wrong = [t for t in answers.practical_touches if t not in TOUCHES_BY_ROOM[room]]
        if wrong:
            problems.append(f"practical_touches: {wrong} are not options for {room}")
    if answers.seating_capacity is not None and room != "Dining Room":
        problems.append("seating_capacity: only asked for the Dining Room")
    if answers.bed_size is not None and room != "Bedroom":
        problems.append("bed_size: only asked for the Bedroom")
    return problems


def to_query(answers: ConsultationAnswers) -> Query:
    """Only call on answers `validate` accepted."""
    assert answers.room_type and answers.aesthetic and answers.materiality
    assert answers.atmosphere
    return Query(
        room=answers.room_type,
        aesthetic=answers.aesthetic,
        materiality=answers.materiality,
        atmosphere=answers.atmosphere,
        touches=tuple(catalogue_touch(t) for t in answers.practical_touches),
        seating=answers.seating_capacity,
        bed_size=answers.bed_size,
    )


_CLOSED_BAND = re.compile(r"\$([\d,]+)-\$([\d,]+)")
_OPEN_BAND = re.compile(r"\$([\d,]+)\+")


def investment_ceiling(band: str) -> int | None:
    """Top of the band in whole currency units; `None` for the open top band.

    The ceiling is the top of the band (owner-accepted, STATUS session 22).
    `$66,000+` has no top, so no ceiling is applied and none is invented.
    """
    closed = _CLOSED_BAND.fullmatch(band)
    if closed:
        return int(closed.group(2).replace(",", ""))
    if _OPEN_BAND.fullmatch(band):
        return None
    raise ValueError(f"not an investment band: {band!r}")
