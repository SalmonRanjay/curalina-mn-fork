"""`build_style_descriptors`: extracts designer-authored descriptor words
from the mapper workbook's `Design Style Definitions` sheet, keyed by
canonical style, for `RuleOnlyEncoder`'s lexical baseline."""

from __future__ import annotations

from pathlib import Path

import openpyxl

from curalina_recommendation.evaluation.style_descriptors import build_style_descriptors
from curalina_recommendation.evaluation.vocabulary import VocabularyMap


def _vocab() -> VocabularyMap:
    return VocabularyMap(
        canonical_styles=("Modern Farmhouse", "Organic Modern"),
        canonical_tags=(),
        canonical_rooms=(),
        material_family_tags=(),
        tag_reference={},
        style_synonyms={"farmhouse": "Modern Farmhouse"},
        style_out_of_axis={},
        tag_synonyms={},
        tag_out_of_axis={},
        room_synonyms={},
    )


def _write_definitions_workbook(path: Path, rows: list[tuple[str, str]]) -> None:
    workbook = openpyxl.Workbook()
    sheet = workbook.active
    sheet.title = "Design Style Definitions"
    sheet.append(["Label", "Text"])
    for label, text in rows:
        sheet.append([label, text])
    workbook.save(path)


def test_extracts_descriptor_words_under_a_recognized_style_header(
    tmp_path: Path,
) -> None:
    path = tmp_path / "mapper.xlsx"
    _write_definitions_workbook(
        path,
        [
            (
                "Design Style: Modern Farmhouse",
                "Rustic weathered wood with cozy textiles",
            ),
        ],
    )

    descriptors = build_style_descriptors(str(path), _vocab())

    assert "Modern Farmhouse" in descriptors
    words = descriptors["Modern Farmhouse"]
    assert "rustic" in words
    assert "weathered" in words
    assert "cozy" in words
    assert "textiles" in words


def test_short_words_below_min_length_are_excluded(tmp_path: Path) -> None:
    path = tmp_path / "mapper.xlsx"
    _write_definitions_workbook(
        path,
        [("Design Style: Modern Farmhouse", "A big red barn and old rugs")],
    )

    descriptors = build_style_descriptors(str(path), _vocab())

    words = descriptors["Modern Farmhouse"]
    # "a", "big", "red", "old" are all < 4 chars and must be excluded.
    assert "a" not in words
    assert "big" not in words
    assert "red" not in words
    assert "old" not in words
    assert "barn" in words
    assert "rugs" in words


def test_stopwords_are_excluded_even_when_long_enough(tmp_path: Path) -> None:
    path = tmp_path / "mapper.xlsx"
    _write_definitions_workbook(
        path,
        [
            (
                "Design Style: Modern Farmhouse",
                "This style comes from their primary keyword search",
            )
        ],
    )

    descriptors = build_style_descriptors(str(path), _vocab())

    words = descriptors["Modern Farmhouse"]
    for stopword in ("this", "from", "their", "primary", "keyword", "search"):
        assert stopword not in words
    assert "style" in words
    assert "comes" in words


def test_seo_strategy_labeled_rows_are_excluded_from_descriptors(
    tmp_path: Path,
) -> None:
    path = tmp_path / "mapper.xlsx"
    _write_definitions_workbook(
        path,
        [
            ("Design Style: Modern Farmhouse", "Cozy rustic textiles"),
            ("SEO Strategy", "unrelated marketing jargon blast"),
        ],
    )

    descriptors = build_style_descriptors(str(path), _vocab())

    words = descriptors["Modern Farmhouse"]
    assert "marketing" not in words
    assert "jargon" not in words
    assert "unrelated" not in words
    assert "cozy" in words


def test_unrecognized_style_header_stops_attribution_until_next_recognized_header(
    tmp_path: Path,
) -> None:
    path = tmp_path / "mapper.xlsx"
    _write_definitions_workbook(
        path,
        [
            ("Design Style: Nobody Authored This Style", "stray orphan words"),
            ("some other label", "should not attribute anywhere"),
            ("Design Style: Organic Modern", "clean natural organic textures"),
        ],
    )

    descriptors = build_style_descriptors(str(path), _vocab())

    assert "Nobody Authored This Style" not in descriptors
    for word_set in descriptors.values():
        assert "stray" not in word_set
        assert "orphan" not in word_set
    assert "Organic Modern" in descriptors
    assert "natural" in descriptors["Organic Modern"]


def test_text_rows_following_a_header_continue_attributing_to_the_active_style(
    tmp_path: Path,
) -> None:
    path = tmp_path / "mapper.xlsx"
    _write_definitions_workbook(
        path,
        [
            ("Design Style: Modern Farmhouse", "cozy textiles"),
            ("", "rustic reclaimed timber"),
            ("Secondary Keywords", "weathered patina finish"),
        ],
    )

    descriptors = build_style_descriptors(str(path), _vocab())

    words = descriptors["Modern Farmhouse"]
    assert "rustic" in words
    assert "reclaimed" in words
    assert "timber" in words
    assert "weathered" in words
    assert "patina" in words
    assert "finish" in words


def test_style_synonym_in_header_resolves_to_canonical_style_key(
    tmp_path: Path,
) -> None:
    path = tmp_path / "mapper.xlsx"
    _write_definitions_workbook(
        path,
        [("Design Style: Farmhouse", "rustic reclaimed timber")],
    )

    descriptors = build_style_descriptors(str(path), _vocab())

    assert "Modern Farmhouse" in descriptors
    assert "rustic" in descriptors["Modern Farmhouse"]


def test_rows_before_any_recognized_style_header_are_not_attributed(
    tmp_path: Path,
) -> None:
    path = tmp_path / "mapper.xlsx"
    _write_definitions_workbook(
        path,
        [
            ("preamble", "orphan introductory words"),
            ("Design Style: Modern Farmhouse", "cozy textiles"),
        ],
    )

    descriptors = build_style_descriptors(str(path), _vocab())

    for word_set in descriptors.values():
        assert "orphan" not in word_set
        assert "introductory" not in word_set
