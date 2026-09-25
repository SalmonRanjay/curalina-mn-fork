"""Colour palettes derived from brief.atmosphere and brief.style."""

from __future__ import annotations

from dataclasses import dataclass

RGB = tuple[int, int, int]


class UnsupportedBrief(ValueError):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code


@dataclass(frozen=True)
class Palette:
    back_wall: RGB
    side_wall: RGB
    ceiling: RGB
    skirting: RGB
    window_light: RGB
    floor: RGB
    accent: RGB


def _norm(s: str) -> str:
    return " ".join(s.lower().replace("&", "and").split())


# (back wall, side wall, ceiling, skirting, window light)
_ATMOSPHERE: dict[str, tuple[RGB, RGB, RGB, RGB, RGB]] = {
    "bright and airy": (
        (245, 240, 230),
        (233, 226, 214),
        (250, 248, 243),
        (252, 250, 246),
        (255, 253, 240),
    ),
    "warm and balanced": (
        (222, 200, 172),
        (204, 178, 150),
        (236, 222, 202),
        (196, 132, 100),
        (250, 234, 200),
    ),
    "dark and moody": (
        (58, 58, 62),
        (46, 44, 46),
        (38, 36, 38),
        (92, 70, 56),
        (120, 130, 150),
    ),
}

# style -> (floor tone, accent colour)
_STYLE: dict[str, tuple[RGB, RGB]] = {
    "organic modern": ((176, 146, 108), (120, 128, 92)),
    "contemporary luxe": ((92, 74, 64), (184, 150, 84)),
    "mid century scandinavian": ((200, 168, 122), (204, 128, 62)),
}


def palette_for(atmosphere: str, style: str) -> Palette:
    a = _atmosphere_key(atmosphere)
    s = _norm(style).replace("-", " ")
    if a not in _ATMOSPHERE:
        raise UnsupportedBrief(
            "unsupported_atmosphere", f"unsupported atmosphere: {atmosphere!r}"
        )
    if s not in _STYLE:
        raise UnsupportedBrief("unsupported_style", f"unsupported style: {style!r}")
    back, side, ceil, skirt, light = _ATMOSPHERE[a]
    floor, accent = _STYLE[s]
    return Palette(back, side, ceil, skirt, light, floor, accent)


def _atmosphere_key(atmosphere: str) -> str:
    return _norm(atmosphere)
