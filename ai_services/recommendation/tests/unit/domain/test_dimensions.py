"""Named test: unit conversion (in/mm)."""

from __future__ import annotations

from decimal import Decimal

import pytest

from curalina_recommendation.domain.dimensions import (
    Dimensions,
    Millimetres,
    inches_to_mm,
)


def test_inches_to_mm_exact_multiplication() -> None:
    # 10in * 25.4 = 254mm exactly; no rounding ambiguity to hide a bug.
    assert inches_to_mm(Decimal("10")) == Millimetres(254)


def test_inches_to_mm_rounds_half_to_even() -> None:
    # 0.5in * 25.4 = 12.7mm -> rounds to 13 (nearest integer, not banker's
    # tie here since 12.7 isn't exactly halfway, but exercises the
    # quantize path with a non-integral result).
    assert inches_to_mm(Decimal("0.5")) == Millimetres(13)


def test_inches_to_mm_rejects_non_positive() -> None:
    with pytest.raises(ValueError):
        inches_to_mm(Decimal("0"))
    with pytest.raises(ValueError):
        inches_to_mm(Decimal("-1"))


def test_dimensions_from_inches_converts_all_axes() -> None:
    dimensions = Dimensions.from_inches(
        width_in=Decimal("40"), height_in=Decimal("30"), depth_in=Decimal("2")
    )
    assert dimensions.width_mm == Millimetres(1016)
    assert dimensions.height_mm == Millimetres(762)
    assert dimensions.depth_mm == Millimetres(51)


def test_dimensions_depth_is_optional() -> None:
    dimensions = Dimensions.from_inches(width_in=Decimal("10"), height_in=Decimal("5"))
    assert dimensions.depth_mm is None


def test_millimetres_rejects_negative() -> None:
    with pytest.raises(ValueError):
        Millimetres(-1)
