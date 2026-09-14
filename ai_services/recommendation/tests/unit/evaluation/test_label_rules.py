"""§D4/§D4a relevance-label derivation."""

from __future__ import annotations

from curalina_recommendation.evaluation.label_rules import Brief, label_product
from curalina_recommendation.evaluation.label_source import LabelSourceRecord
from curalina_recommendation.evaluation.vocabulary import VocabularyMap


def _vocab() -> VocabularyMap:
    return VocabularyMap(
        canonical_styles=("Modern Farmhouse",),
        canonical_tags=("Warm Neutrals", "Earth & Stone"),
        canonical_rooms=("Dining room",),
        material_family_tags=(),
        tag_reference={},
        style_synonyms={},
        style_out_of_axis={},
        tag_synonyms={},
        tag_out_of_axis={"outdoor suitable": "functional"},
        room_synonyms={},
    )


def _record(**overrides: object) -> LabelSourceRecord:
    base = dict(
        product_id="p1",
        supplier_id="Four Hands",
        price=None,
        width_in=None,
        room_types_raw=("Dining room",),
        design_styles_raw=("Modern Farmhouse",),
        tags_raw=("Warm Neutrals",),
        categories_raw=("Dining Chairs",),
    )
    base.update(overrides)
    return LabelSourceRecord(**base)  # type: ignore[arg-type]


_BRIEF = Brief(
    brief_id="b1",
    stratum="A",
    room_type="Dining room",
    categories=("Dining Chairs",),
    style="Modern Farmhouse",
    atmosphere="Warm Neutrals",
)


def test_precondition_fail_grades_zero() -> None:
    result = label_product(_BRIEF, _record(room_types_raw=("Bedroom",)), _vocab())
    assert result.precondition is False
    assert result.grade == 0


def test_both_axes_match_grades_two() -> None:
    result = label_product(_BRIEF, _record(), _vocab())
    assert result.grade == 2


def test_exactly_one_axis_matches_grades_one() -> None:
    # Style matches the brief's target; the tag axis resolves to a
    # *different* canonical tag, so it does not match — exactly one match.
    result = label_product(_BRIEF, _record(tags_raw=("Earth & Stone",)), _vocab())
    assert result.unmapped is False
    assert result.grade == 1


def test_neither_axis_matches_grades_zero() -> None:
    other_vocab = VocabularyMap(
        canonical_styles=("Modern Farmhouse", "Organic Modern"),
        canonical_tags=("Warm Neutrals", "Earth & Stone"),
        canonical_rooms=("Dining room",),
        material_family_tags=(),
    )
    result = label_product(
        _BRIEF,
        _record(design_styles_raw=("Organic Modern",), tags_raw=("Earth & Stone",)),
        other_vocab,
    )
    assert result.grade == 0


def test_axis_with_every_token_unresolvable_is_unmapped_and_excluded() -> None:
    record = _record(design_styles_raw=("Gibberish Style",))
    result = label_product(_BRIEF, record, _vocab())
    assert result.unmapped is True
    assert result.grade is None


def test_out_of_axis_does_not_cause_unmapped_when_a_canonical_token_resolves() -> None:
    result = label_product(
        _BRIEF, _record(tags_raw=("Warm Neutrals", "Outdoor Suitable")), _vocab()
    )
    assert result.unmapped is False
    assert result.partial_normalization is False
    assert result.grade == 2


def test_partial_normalization_reported_but_not_gating() -> None:
    result = label_product(
        _BRIEF, _record(tags_raw=("Warm Neutrals", "Some Unresolvable Token")), _vocab()
    )
    assert result.unmapped is False
    assert result.partial_normalization is True
    assert result.grade == 2
