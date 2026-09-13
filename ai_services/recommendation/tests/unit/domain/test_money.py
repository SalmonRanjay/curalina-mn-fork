"""Named test: currency mismatch.

Also covers `decimal.Decimal`-only enforcement and minor-unit round-trips,
since `Money` is the type every other named test (budget boundary,
quantity totals) depends on.
"""

from __future__ import annotations

from decimal import Decimal

import pytest

from curalina_recommendation.domain.errors import CurrencyMismatchError
from curalina_recommendation.domain.money import Money, sum_money


def test_money_rejects_float_amount() -> None:
    with pytest.raises(TypeError):
        Money(19.99, "USD")  # type: ignore[arg-type]


def test_money_normalizes_currency_case() -> None:
    money = Money(Decimal("10.00"), "usd")
    assert money.currency == "USD"


def test_money_rejects_non_iso_currency() -> None:
    with pytest.raises(ValueError):
        Money(Decimal("10.00"), "US")


def test_money_multiply_rejects_negative_quantity() -> None:
    with pytest.raises(ValueError):
        Money(Decimal("10.00"), "USD") * -1


def test_money_multiply_rejects_non_int_quantity() -> None:
    with pytest.raises(TypeError):
        Money(Decimal("10.00"), "USD") * True  # type: ignore[operator]


def test_money_ordering_operators() -> None:
    cheaper = Money(Decimal("5.00"), "USD")
    pricier = Money(Decimal("10.00"), "USD")
    assert cheaper < pricier
    assert pricier > cheaper
    assert pricier >= pricier


def test_money_minor_units_round_trip() -> None:
    money = Money.from_minor_units(1999, "USD")
    assert money.amount == Decimal("19.99")
    assert money.to_minor_units() == 1999


def test_currency_mismatch_on_addition_raises() -> None:
    usd = Money(Decimal("10.00"), "USD")
    cad = Money(Decimal("10.00"), "CAD")

    with pytest.raises(CurrencyMismatchError) as excinfo:
        usd + cad

    assert excinfo.value.expected == "USD"
    assert excinfo.value.actual == "CAD"


def test_currency_mismatch_on_comparison_raises() -> None:
    usd = Money(Decimal("10.00"), "USD")
    cad = Money(Decimal("10.00"), "CAD")

    with pytest.raises(CurrencyMismatchError):
        assert usd <= cad


def test_currency_mismatch_on_sum_money_raises() -> None:
    usd = Money(Decimal("10.00"), "USD")
    cad = Money(Decimal("5.00"), "CAD")

    with pytest.raises(CurrencyMismatchError):
        sum_money((usd, cad), currency="USD")


def test_same_currency_sum_is_exact() -> None:
    amounts = (
        Money(Decimal("10.00"), "USD"),
        Money(Decimal("5.50"), "USD"),
    )
    assert sum_money(amounts, currency="USD") == Money(Decimal("15.50"), "USD")
