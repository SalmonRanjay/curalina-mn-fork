"""Dimension and clearance value objects.

Per `agent_instructions/01_recommendation_service.md` and the project-wide
stack decision, dimensions are always integer millimetres in the domain.
Source workbooks report inches (`architecture/guides/03_data_contracts.md`:
"Width and Height in inches ... Multiply by 25.4; preserve precision;
positive numeric values"); `Dimensions.from_inches` is the one place that
conversion happens, so every other domain function only ever sees mm.
"""

from __future__ import annotations

from dataclasses import dataclass
from decimal import ROUND_HALF_EVEN, Decimal

MM_PER_INCH = Decimal("25.4")


@dataclass(frozen=True, slots=True)
class Millimetres:
    """A non-negative integer millimetre measurement."""

    value: int

    def __post_init__(self) -> None:
        if not isinstance(self.value, int) or isinstance(self.value, bool):
            raise TypeError("Millimetres.value must be an int")
        if self.value < 0:
            raise ValueError("Millimetres.value must be >= 0")

    def __int__(self) -> int:
        return self.value


def inches_to_mm(value_in: Decimal) -> Millimetres:
    """Convert an inch measurement to whole millimetres.

    Per `03_data_contracts.md`: "Multiply by 25.4; preserve precision;
    positive numeric values." Precision is preserved through the
    multiplication itself (exact `Decimal` arithmetic); the domain's
    millimetre type is an integer, so the final rounding step is banker's
    rounding, applied once, at this single conversion boundary.
    """

    if value_in <= 0:
        raise ValueError(f"dimension in inches must be positive, got {value_in}")
    mm = (value_in * MM_PER_INCH).quantize(Decimal("1"), rounding=ROUND_HALF_EVEN)
    return Millimetres(int(mm))


@dataclass(frozen=True, slots=True)
class Dimensions:
    """A product's or footprint's physical envelope, in millimetres."""

    width_mm: Millimetres
    height_mm: Millimetres
    depth_mm: Millimetres | None = None

    @classmethod
    def from_inches(
        cls,
        *,
        width_in: Decimal,
        height_in: Decimal,
        depth_in: Decimal | None = None,
    ) -> Dimensions:
        return cls(
            width_mm=inches_to_mm(width_in),
            height_mm=inches_to_mm(height_in),
            depth_mm=inches_to_mm(depth_in) if depth_in is not None else None,
        )


@dataclass(frozen=True, slots=True)
class Clearance:
    """A minimum required clearance distance, in millimetres.

    This is a value object only; evaluating whether a given room geometry
    can satisfy a clearance is spatial-composition logic (workflow step 5,
    blocked on R03 and delegated to `curalina_design_rules` — see
    `ports/bundle_composer.py`), not something this type computes itself.
    """

    min_mm: Millimetres
