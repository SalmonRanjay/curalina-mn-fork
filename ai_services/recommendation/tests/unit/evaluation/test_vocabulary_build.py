"""`build_vocabulary_map`: authors the frozen `VocabularyMap` from the
mapper workbook's canonical lists plus the hand-authored synonym/
out-of-axis dictionaries."""

from __future__ import annotations

from pathlib import Path

import openpyxl

from curalina_recommendation.evaluation.vocabulary import MATERIAL_FAMILY_TAGS, Bucket
from curalina_recommendation.evaluation.vocabulary_build import build_vocabulary_map

_N_COLS = 13


def _row(
    room: str = "", style: str = "", category: str = "", tag: str = ""
) -> list[str]:
    row = [""] * _N_COLS
    row[1] = room
    row[3] = style
    row[9] = category
    row[11] = tag
    return row


def _write_mapper_workbook(path: Path) -> None:
    workbook = openpyxl.Workbook()
    sheet = workbook.active
    sheet.title = "SUB-CATEGORIES"
    sheet.append(["h"] * _N_COLS)
    sheet.append(
        _row(
            room="Living room",
            style="Modern Farmhouse",
            category="Sofa",
            tag="Warm Neutrals",
        )
    )
    sheet.append(
        _row(
            room="Dining room",
            style="Organic Modern",
            category="Dining Chairs",
            tag="Earth & Stone",
        )
    )
    workbook.save(path)


def test_build_vocabulary_map_carries_the_mapper_workbooks_canonical_lists(
    tmp_path: Path,
) -> None:
    path = tmp_path / "mapper.xlsx"
    _write_mapper_workbook(path)

    vocab = build_vocabulary_map(str(path))

    assert vocab.canonical_styles == ("Modern Farmhouse", "Organic Modern")
    assert vocab.canonical_tags == ("Warm Neutrals", "Earth & Stone")
    assert vocab.canonical_rooms == ("Living room", "Dining room")
    assert vocab.material_family_tags == MATERIAL_FAMILY_TAGS


def test_style_synonym_farmhouse_resolves_to_canonical_modern_farmhouse(
    tmp_path: Path,
) -> None:
    path = tmp_path / "mapper.xlsx"
    _write_mapper_workbook(path)
    vocab = build_vocabulary_map(str(path))

    bucket, canon = vocab.classify("farmhouse", "style")

    assert bucket is Bucket.CANONICAL
    assert canon == "Modern Farmhouse"


def test_style_synonym_is_case_and_whitespace_insensitive(tmp_path: Path) -> None:
    path = tmp_path / "mapper.xlsx"
    _write_mapper_workbook(path)
    vocab = build_vocabulary_map(str(path))

    bucket, canon = vocab.classify("  FARMHOUSE  ", "style")

    assert bucket is Bucket.CANONICAL
    assert canon == "Modern Farmhouse"


def test_room_type_string_misfiled_into_style_column_is_out_of_axis(
    tmp_path: Path,
) -> None:
    path = tmp_path / "mapper.xlsx"
    _write_mapper_workbook(path)
    vocab = build_vocabulary_map(str(path))

    bucket, canon = vocab.classify("Living Room", "style")

    assert bucket is Bucket.OUT_OF_AXIS
    assert canon is None


def test_functional_tag_outdoor_suitable_is_out_of_axis_not_unresolvable(
    tmp_path: Path,
) -> None:
    path = tmp_path / "mapper.xlsx"
    _write_mapper_workbook(path)
    vocab = build_vocabulary_map(str(path))

    bucket, canon = vocab.classify("Outdoor Suitable", "tag")

    assert bucket is Bucket.OUT_OF_AXIS
    assert canon is None


def test_material_noun_marble_is_out_of_axis_for_the_tag_axis(tmp_path: Path) -> None:
    path = tmp_path / "mapper.xlsx"
    _write_mapper_workbook(path)
    vocab = build_vocabulary_map(str(path))

    bucket, canon = vocab.classify("Marble", "tag")

    assert bucket is Bucket.OUT_OF_AXIS
    assert canon is None


def test_tag_synonym_family_gatherings_variant_resolves_to_canonical_spelling(
    tmp_path: Path,
) -> None:
    path = tmp_path / "mapper.xlsx"
    _write_mapper_workbook(path)
    vocab = build_vocabulary_map(str(path))

    bucket, canon = vocab.classify("family gatherings/hunble", "tag")

    assert bucket is Bucket.CANONICAL
    assert canon == "Family Gatherings/ Humble"


def test_room_synonym_resolves_living_room_to_canonical_capitalization(
    tmp_path: Path,
) -> None:
    path = tmp_path / "mapper.xlsx"
    _write_mapper_workbook(path)
    vocab = build_vocabulary_map(str(path))

    bucket, canon = vocab.classify("living room", "room")

    assert bucket is Bucket.CANONICAL
    assert canon == "Living room"


def test_unresolvable_style_token_stays_unresolvable_never_best_guessed(
    tmp_path: Path,
) -> None:
    path = tmp_path / "mapper.xlsx"
    _write_mapper_workbook(path)
    vocab = build_vocabulary_map(str(path))

    bucket, canon = vocab.classify("Totally Unknown Style Nobody Authored", "style")

    assert bucket is Bucket.UNRESOLVABLE
    assert canon is None
