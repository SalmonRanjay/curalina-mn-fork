"""`read_mapper_canonical_lists`: extracts canonical `Rooms`/`Design
Style`/`Furniture Category`/`Tags`/`Tag Reference` lists from the mapper
workbook's `SUB-CATEGORIES` sheet, de-duplicated and order-preserving."""

from __future__ import annotations

from pathlib import Path

import openpyxl

from curalina_recommendation.evaluation.mapper_workbook import (
    read_mapper_canonical_lists,
)

# Column indices per `mapper_workbook.py`: room=1, style=3, category=9,
# tag=11, tag_reference=12 (0-based).
_N_COLS = 13


def _row(
    room: str = "",
    style: str = "",
    category: str = "",
    tag: str = "",
    tag_ref: str = "",
) -> list[str]:
    row = [""] * _N_COLS
    row[1] = room
    row[3] = style
    row[9] = category
    row[11] = tag
    row[12] = tag_ref
    return row


def _write_mapper_workbook(path: Path, rows: list[list[str]]) -> None:
    workbook = openpyxl.Workbook()
    sheet = workbook.active
    sheet.title = "SUB-CATEGORIES"
    sheet.append(["h"] * _N_COLS)  # header row, discarded by the reader
    for row in rows:
        sheet.append(row)
    workbook.save(path)


def test_reads_rooms_styles_categories_and_tags_from_the_correct_columns(
    tmp_path: Path,
) -> None:
    path = tmp_path / "mapper.xlsx"
    _write_mapper_workbook(
        path,
        [
            _row(
                room="Living room",
                style="Modern Farmhouse",
                category="Sofa",
                tag="Warm Neutrals",
            ),
            _row(
                room="Dining room",
                style="Organic Modern",
                category="Dining Chairs",
                tag="Earth & Stone",
            ),
        ],
    )

    lists = read_mapper_canonical_lists(str(path))

    assert lists.rooms == ("Living room", "Dining room")
    assert lists.styles == ("Modern Farmhouse", "Organic Modern")
    assert lists.categories == ("Sofa", "Dining Chairs")
    assert lists.tags == ("Warm Neutrals", "Earth & Stone")


def test_deduplicates_while_preserving_first_seen_order(tmp_path: Path) -> None:
    path = tmp_path / "mapper.xlsx"
    _write_mapper_workbook(
        path,
        [
            _row(
                room="Living room",
                style="Modern Farmhouse",
                category="Sofa",
                tag="Warm Neutrals",
            ),
            _row(
                room="Dining room",
                style="Modern Farmhouse",
                category="Sofa",
                tag="Warm Neutrals",
            ),
            _row(
                room="Living room",
                style="Organic Modern",
                category="Dining Chairs",
                tag="Earth & Stone",
            ),
        ],
    )

    lists = read_mapper_canonical_lists(str(path))

    assert lists.rooms == ("Living room", "Dining room")
    assert lists.styles == ("Modern Farmhouse", "Organic Modern")
    assert lists.categories == ("Sofa", "Dining Chairs")
    assert lists.tags == ("Warm Neutrals", "Earth & Stone")


def test_blank_cells_are_skipped_not_recorded_as_empty_strings(tmp_path: Path) -> None:
    path = tmp_path / "mapper.xlsx"
    _write_mapper_workbook(
        path,
        [
            _row(room="Living room"),  # style/category/tag blank
            _row(style="Organic Modern"),  # room/category/tag blank
        ],
    )

    lists = read_mapper_canonical_lists(str(path))

    assert lists.rooms == ("Living room",)
    assert lists.styles == ("Organic Modern",)
    assert lists.categories == ()
    assert lists.tags == ()


def test_whitespace_only_cells_are_treated_as_blank(tmp_path: Path) -> None:
    path = tmp_path / "mapper.xlsx"
    _write_mapper_workbook(path, [_row(room="   ", style="Modern Farmhouse")])

    lists = read_mapper_canonical_lists(str(path))

    assert lists.rooms == ()
    assert lists.styles == ("Modern Farmhouse",)


def test_cell_values_are_stripped_of_surrounding_whitespace(tmp_path: Path) -> None:
    path = tmp_path / "mapper.xlsx"
    _write_mapper_workbook(path, [_row(room="  Living room  ")])

    lists = read_mapper_canonical_lists(str(path))

    assert lists.rooms == ("Living room",)


def test_tag_reference_is_only_recorded_when_both_tag_and_reference_present(
    tmp_path: Path,
) -> None:
    path = tmp_path / "mapper.xlsx"
    _write_mapper_workbook(
        path,
        [
            _row(tag="Warm Neutrals", tag_ref="Neutral base palette"),
            _row(tag_ref="Reference with no tag"),  # tag blank -> not recorded
            _row(tag="Earth & Stone"),  # reference blank -> not recorded
        ],
    )

    lists = read_mapper_canonical_lists(str(path))

    assert lists.tag_reference == {"Warm Neutrals": "Neutral base palette"}
