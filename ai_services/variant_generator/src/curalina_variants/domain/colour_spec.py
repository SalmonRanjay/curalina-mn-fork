"""Colour and material value objects.

Pure, framework-free records: no PIL/OpenCV/colour-science import, no I/O.
`RgbColour` is deliberately dumb — it validates channel ranges and hex
parsing only. It performs no colour-space conversion (no LAB/XYZ math); that
is `ColourTransferAdapter`'s job (`ports/colour_transfer.py`), gated behind
V01.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

_HEX_COLOUR_RE = re.compile(r"^#[0-9a-fA-F]{6}$")


@dataclass(frozen=True, slots=True)
class RgbColour:
    """An 8-bit-per-channel sRGB colour. No LAB/XYZ conversion lives here."""

    red: int
    green: int
    blue: int

    def __post_init__(self) -> None:
        channels = (("red", self.red), ("green", self.green), ("blue", self.blue))
        for name, value in channels:
            if not 0 <= value <= 255:
                raise ValueError(f"RgbColour.{name} must be within 0..255, got {value}")

    @property
    def hex(self) -> str:
        return f"#{self.red:02x}{self.green:02x}{self.blue:02x}"

    @classmethod
    def from_hex(cls, value: str) -> RgbColour:
        """Parse a `#rrggbb` string. Raises `ValueError` on any other shape —
        this is the "bad colour codes" guard the workflow's mandatory test
        list calls for."""
        if not _HEX_COLOUR_RE.match(value):
            raise ValueError(f"invalid hex colour code: {value!r}")
        return cls(int(value[1:3], 16), int(value[3:5], 16), int(value[5:7], 16))


@dataclass(frozen=True, slots=True)
class MaterialSpec:
    """Upholstery material identity, independent of colour (e.g. "velvet",
    "boucle"). Optional `finish` (e.g. "matte", "brushed") for hard
    materials/hardware."""

    material_name: str
    finish: str | None = None

    def __post_init__(self) -> None:
        if not self.material_name.strip():
            raise ValueError("MaterialSpec.material_name must not be blank")
        if self.finish is not None and not self.finish.strip():
            raise ValueError("MaterialSpec.finish must not be blank when provided")


@dataclass(frozen=True, slots=True)
class ColourSpec:
    """The target recolour request: a colour, its human-facing name (as shown
    to designers/reviewers), and an optional material. `colour_name` is kept
    distinct from the hex code because reviewers and manifests reference the
    name (e.g. "Charcoal"), not the hex value."""

    colour: RgbColour
    colour_name: str
    material: MaterialSpec | None = None

    def __post_init__(self) -> None:
        if not self.colour_name.strip():
            raise ValueError("ColourSpec.colour_name must not be blank")
