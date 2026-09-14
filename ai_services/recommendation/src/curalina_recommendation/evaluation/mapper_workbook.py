"""Reads canonical vocabulary from the client's Quiz and Product Mapper
workbook (`SUB-CATEGORIES` sheet: `Rooms`, `Design Style`, `Furniture
Category`, `Tags`, `Tag Reference (Based on Style)` columns).

This is evaluation-only support code, feeding the frozen vocabulary map —
never `Product`, never a `FeatureEncoder`. `openpyxl` access still routes
through `adapters.xlsx_workbook_reader.read_workbook_rows`.
"""

from __future__ import annotations

from dataclasses import dataclass

from curalina_recommendation.adapters.xlsx_workbook_reader import read_workbook_rows

_COL_ROOM = 1
_COL_STYLE = 3
_COL_CATEGORY = 9
_COL_TAG = 11
_COL_TAG_REFERENCE = 12


@dataclass(frozen=True, slots=True)
class MapperCanonicalLists:
    rooms: tuple[str, ...]
    styles: tuple[str, ...]
    categories: tuple[str, ...]
    tags: tuple[str, ...]
    tag_reference: dict[str, str]


def read_mapper_canonical_lists(mapper_path: str) -> MapperCanonicalLists:
    workbook = read_workbook_rows(mapper_path, sheet_name="SUB-CATEGORIES")
    rooms: list[str] = []
    styles: list[str] = []
    categories: list[str] = []
    tags: list[str] = []
    tag_reference: dict[str, str] = {}
    def _cell(row: tuple[object, ...], idx: int) -> str | None:
        value = row[idx] if len(row) > idx else None
        if isinstance(value, str) and value.strip():
            return value.strip()
        return None

    for row in workbook.rows:
        if (v := _cell(row, _COL_ROOM)) is not None:
            rooms.append(v)
        if (v := _cell(row, _COL_STYLE)) is not None:
            styles.append(v)
        if (v := _cell(row, _COL_CATEGORY)) is not None:
            categories.append(v)
        tag = _cell(row, _COL_TAG)
        if tag is not None:
            tags.append(tag)
        ref = _cell(row, _COL_TAG_REFERENCE)
        if tag is not None and ref is not None:
            tag_reference[tag] = ref
    return MapperCanonicalLists(
        rooms=tuple(dict.fromkeys(rooms)),
        styles=tuple(dict.fromkeys(styles)),
        categories=tuple(dict.fromkeys(categories)),
        tags=tuple(dict.fromkeys(tags)),
        tag_reference=tag_reference,
    )
