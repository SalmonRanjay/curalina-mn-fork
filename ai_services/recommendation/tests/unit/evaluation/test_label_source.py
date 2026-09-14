"""Unit tests for the label-source reader (never imported by `domain/`,
`ports/`, or any `FeatureEncoder` -- ADR-0006 §D2's firewall).

Each test writes a tiny synthetic `.xlsx` via `openpyxl`, shaped like the
pinned file's 36-column layout (same convention as
`tests/unit/adapters/test_xlsx_catalogue_importer.py`), never the real
`attached_assets` workbook.
"""

from __future__ import annotations

from decimal import Decimal
from pathlib import Path

import openpyxl

from curalina_recommendation.evaluation.label_source import (
    LabelSourceRecord,
    _slugify,
    _split_multi,
    read_label_source_records,
)

_HEADER = [f"col{i}" for i in range(36)]


def _row(
    *,
    name: str = "Test Product",
    overview: object = None,
    supplier: object = "Four Hands",
    sku: object = "SKU-1",
    retail_price: object = "100.00",
    category: object = "Sofa, Seating",
    room_type: object = "Living Room, Den",
    design_style: object = "Modern, Coastal",
    tags: object = "cozy, bestseller",
    dims_moes: object = None,
    dims_four_hands: object = '30"w x 20"d x 40"h',
) -> list[object]:
    row: list[object] = [None] * 36
    row[0] = name
    row[1] = overview
    row[2] = supplier
    row[3] = sku
    row[5] = retail_price
    row[6] = category
    row[7] = room_type
    row[8] = design_style
    row[11] = dims_moes
    row[26] = tags
    row[29] = dims_four_hands
    return row


def _write_workbook(tmp_path: Path, rows: list[list[object]]) -> Path:
    workbook = openpyxl.Workbook()
    sheet = workbook.active
    assert sheet is not None
    sheet.append(_HEADER)
    for row in rows:
        sheet.append(row)
    path = tmp_path / "label_source.xlsx"
    workbook.save(path)
    return path


# --- happy path: all six named fields plus derived identity -----------


def test_reads_all_six_named_fields_from_a_well_formed_row(tmp_path: Path) -> None:
    path = _write_workbook(tmp_path, [_row()])

    records = read_label_source_records(str(path))

    assert len(records) == 1
    record = records[0]
    assert record.supplier_id == "Four Hands"
    assert record.price == Decimal("100.00")
    assert record.room_types_raw == ("Living Room", "Den")
    assert record.design_styles_raw == ("Modern", "Coastal")
    assert record.tags_raw == ("cozy", "bestseller")
    assert record.categories_raw == ("Sofa", "Seating")


def test_product_id_joins_slugified_supplier_and_normalized_sku(
    tmp_path: Path,
) -> None:
    path = _write_workbook(tmp_path, [_row(supplier="Four Hands", sku="  SKU-1  ")])

    records = read_label_source_records(str(path))

    assert records[0].product_id == "four-hands:SKU-1"


def test_reads_width_from_dimension_columns(tmp_path: Path) -> None:
    path = _write_workbook(
        tmp_path, [_row(dims_four_hands='30"w x 20"d x 40"h', dims_moes=None)]
    )

    records = read_label_source_records(str(path))

    assert records[0].width_in == Decimal("30")


# --- malformed / missing source data ------------------------------------


def test_row_with_blank_supplier_is_skipped_from_workbook(tmp_path: Path) -> None:
    path = _write_workbook(tmp_path, [_row(supplier=None), _row(supplier="  ")])

    records = read_label_source_records(str(path))

    assert records == ()


def test_row_with_non_string_supplier_is_skipped(tmp_path: Path) -> None:
    path = _write_workbook(tmp_path, [_row(supplier=12345)])

    records = read_label_source_records(str(path))

    assert records == ()


def test_row_with_blank_sku_is_skipped(tmp_path: Path) -> None:
    path = _write_workbook(tmp_path, [_row(sku=None), _row(sku="   ")])

    records = read_label_source_records(str(path))

    assert records == ()


def test_row_with_missing_price_yields_none_price_but_is_still_included(
    tmp_path: Path,
) -> None:
    path = _write_workbook(tmp_path, [_row(retail_price=None)])

    records = read_label_source_records(str(path))

    assert len(records) == 1
    assert records[0].price is None


def test_row_with_unparseable_price_yields_none_price(tmp_path: Path) -> None:
    path = _write_workbook(tmp_path, [_row(retail_price="call for price")])

    records = read_label_source_records(str(path))

    assert len(records) == 1
    assert records[0].price is None


def test_row_with_no_dimensions_yields_none_width(tmp_path: Path) -> None:
    path = _write_workbook(
        tmp_path, [_row(dims_four_hands=None, dims_moes=None)]
    )

    records = read_label_source_records(str(path))

    assert records[0].width_in is None


def test_row_with_blank_category_room_type_style_and_tags_yields_empty_tuples(
    tmp_path: Path,
) -> None:
    path = _write_workbook(
        tmp_path,
        [_row(category=None, room_type="", design_style="   ", tags=None)],
    )

    records = read_label_source_records(str(path))

    record = records[0]
    assert record.categories_raw == ()
    assert record.room_types_raw == ()
    assert record.design_styles_raw == ()
    assert record.tags_raw == ()


def test_row_truncated_below_later_columns_yields_none_for_those_fields(
    tmp_path: Path,
) -> None:
    # A short row (only name/overview/supplier/sku populated, no columns
    # beyond index 3 at all) exercises the `len(row) > COL_X else None`
    # defensive branch for every later field, not just a blank cell.
    workbook = openpyxl.Workbook()
    sheet = workbook.active
    assert sheet is not None
    sheet.append(["name", "overview", "supplier", "sku"])
    sheet.append(["Test Product", "An overview", "Four Hands", "SKU-9"])
    path = tmp_path / "short.xlsx"
    workbook.save(path)

    records = read_label_source_records(str(path))

    assert len(records) == 1
    record = records[0]
    assert record.price is None
    assert record.width_in is None
    assert record.room_types_raw == ()
    assert record.design_styles_raw == ()
    assert record.tags_raw == ()
    assert record.categories_raw == ()


# --- _split_multi parsing edge cases ------------------------------------


def test_split_multi_empty_string_yields_empty_tuple() -> None:
    assert _split_multi("") == ()


def test_split_multi_whitespace_only_yields_empty_tuple() -> None:
    assert _split_multi("   ") == ()


def test_split_multi_non_string_yields_empty_tuple() -> None:
    assert _split_multi(None) == ()
    assert _split_multi(42) == ()


def test_split_multi_trailing_delimiter_drops_empty_trailing_token() -> None:
    assert _split_multi("Modern, Coastal,") == ("Modern", "Coastal")


def test_split_multi_leading_delimiter_drops_empty_leading_token() -> None:
    assert _split_multi(",Modern, Coastal") == ("Modern", "Coastal")


def test_split_multi_preserves_mixed_case() -> None:
    assert _split_multi("Modern, COASTAL, rustic") == ("Modern", "COASTAL", "rustic")


def test_split_multi_single_value_no_delimiter() -> None:
    assert _split_multi("Modern") == ("Modern",)


# --- _slugify -------------------------------------------------------------


def test_slugify_lowercases_and_hyphenates_whitespace() -> None:
    assert _slugify("Four Hands") == "four-hands"


def test_slugify_collapses_repeated_internal_whitespace() -> None:
    assert _slugify("  Moe's   Home  ") == "moe's-home"


# --- dataclass shape ------------------------------------------------------


def test_label_source_record_is_frozen_dataclass_with_expected_fields() -> None:
    record = LabelSourceRecord(
        product_id="four-hands:sku-1",
        supplier_id="Four Hands",
        price=Decimal("10"),
        width_in=Decimal("5"),
        room_types_raw=("Living Room",),
        design_styles_raw=("Modern",),
        tags_raw=("cozy",),
        categories_raw=("Sofa",),
    )

    assert record.product_id == "four-hands:sku-1"
