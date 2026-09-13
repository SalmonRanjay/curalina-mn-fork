"""Unit tests for the pure workbook-cell parsing helpers.

These use small synthetic values shaped like the real workbook's cells
(both supplier dimension-string formats, both `Trade Price` columns,
etc.) rather than reading the real `attached_assets` file — that keeps
this suite fast, offline and independent of a file outside the package.
The real file is exercised by the R01 notebook itself.
"""

from __future__ import annotations

from decimal import Decimal

from curalina_recommendation.adapters.xlsx_parsing import (
    UNCONFIRMED_CURRENCY,
    first_non_blank,
    is_datetime_like,
    is_known_junk_category,
    parse_dimensions_inches,
    parse_money_decimal,
    primary_category,
)


def test_first_non_blank_skips_none_and_blank_strings() -> None:
    assert first_non_blank(None, "", "  ", "value") == "value"


def test_first_non_blank_returns_none_when_all_blank() -> None:
    assert first_non_blank(None, "", "   ") is None


def test_parse_money_decimal_uses_str_never_float() -> None:
    # An int cell (as openpyxl yields for a whole-dollar amount) must
    # become an exact Decimal via str(), not a binary float.
    result = parse_money_decimal(1299)
    assert result == Decimal("1299")
    assert isinstance(result, Decimal)


def test_parse_money_decimal_blank_returns_none() -> None:
    assert parse_money_decimal(None) is None
    assert parse_money_decimal("  ") is None


def test_parse_dimensions_moes_home_format_curly_quotes_uppercase() -> None:
    parsed = parse_dimensions_inches("20.5” W X 18.5” D X 22.7” H")
    assert parsed is not None
    assert parsed.width_in == Decimal("20.5")
    assert parsed.depth_in == Decimal("18.5")
    assert parsed.height_in == Decimal("22.7")


def test_parse_dimensions_four_hands_format_straight_quotes_lowercase() -> None:
    parsed = parse_dimensions_inches('78.75"w x 15.00"d x 30.75"h')
    assert parsed is not None
    assert parsed.width_in == Decimal("78.75")
    assert parsed.depth_in == Decimal("15.00")
    assert parsed.height_in == Decimal("30.75")


def test_parse_dimensions_missing_width_or_height_is_unparseable() -> None:
    assert parse_dimensions_inches('15.00"d only depth') is None


def test_parse_dimensions_blank_or_non_string_is_none() -> None:
    assert parse_dimensions_inches(None) is None
    assert parse_dimensions_inches("") is None
    assert parse_dimensions_inches(1234) is None


def test_primary_category_takes_first_comma_token() -> None:
    assert primary_category("End Table, Nightstand") == "End Table"


def test_primary_category_blank_is_none() -> None:
    assert primary_category(None) is None
    assert primary_category("   ") is None


def test_is_known_junk_category_matches_spreadsheet_artefact() -> None:
    assert is_known_junk_category("Final CSV-Ready Summary") is True
    assert is_known_junk_category("Sofa") is False


def test_is_datetime_like() -> None:
    import datetime

    assert is_datetime_like(datetime.date(2025, 11, 3)) is True
    assert is_datetime_like(datetime.datetime(2025, 11, 3)) is True
    assert is_datetime_like("2025-11-03") is False
    assert is_datetime_like(30) is False


def test_unconfirmed_currency_sentinel_is_iso4217_no_currency_code() -> None:
    assert UNCONFIRMED_CURRENCY == "XXX"
