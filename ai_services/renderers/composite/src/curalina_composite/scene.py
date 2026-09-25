"""Procedural room shell drawn with a simple one-point perspective.

All geometry is expressed as fractions of the canvas so any size works. This is
illustrative, not to scale: it only has to look like a plausible room box.
"""

from __future__ import annotations

from dataclasses import dataclass

from PIL import Image, ImageDraw, ImageFilter

from .palette import RGB, Palette

# Back wall rectangle (fractions of canvas). The side walls, floor and ceiling
# are trapezoids joining this rectangle to the canvas edges.
BACK_LEFT = 0.16
BACK_RIGHT = 0.84
BACK_TOP = 0.14
BACK_BOTTOM = 0.62  # horizon line where wall meets floor


@dataclass(frozen=True)
class Geometry:
    width: int
    height: int

    @property
    def bx0(self) -> int:
        return round(self.width * BACK_LEFT)

    @property
    def bx1(self) -> int:
        return round(self.width * BACK_RIGHT)

    @property
    def by0(self) -> int:
        return round(self.height * BACK_TOP)

    @property
    def by1(self) -> int:
        return round(self.height * BACK_BOTTOM)


def _shade(c: RGB, factor: float) -> RGB:
    return (
        max(0, min(255, round(c[0] * factor))),
        max(0, min(255, round(c[1] * factor))),
        max(0, min(255, round(c[2] * factor))),
    )


def draw_shell(geo: Geometry, pal: Palette) -> Image.Image:
    w, h = geo.width, geo.height
    im = Image.new("RGB", (w, h), pal.back_wall)
    d = ImageDraw.Draw(im)
    x0, x1, y0, y1 = geo.bx0, geo.bx1, geo.by0, geo.by1

    d.polygon([(0, 0), (w, 0), (x1, y0), (x0, y0)], fill=pal.ceiling)
    d.polygon([(0, 0), (x0, y0), (x0, y1), (0, h)], fill=pal.side_wall)
    d.polygon([(w, 0), (x1, y0), (x1, y1), (w, h)], fill=_shade(pal.side_wall, 0.94))
    d.rectangle([x0, y0, x1, y1], fill=pal.back_wall)
    d.polygon([(x0, y1), (x1, y1), (w, h), (0, h)], fill=pal.floor)

    # Floorboards converging on the vanishing point (centre of back wall).
    vx, vy = (x0 + x1) / 2, (y0 + y1) / 2
    plank = _shade(pal.floor, 0.9)
    for i in range(7):
        bx = i * (w / 6)
        # intersect the line from (bx, h) to the vanishing point with y = y1
        t = (h - y1) / (h - vy)
        tx = bx + (vx - bx) * t
        d.line([(bx, h), (tx, y1)], fill=plank, width=1)

    # Skirting: back wall strip plus the two side-wall slivers.
    sk = max(3, round((y1 - y0) * 0.05))
    d.rectangle([x0, y1 - sk, x1, y1], fill=pal.skirting)
    d.polygon([(0, h - sk * 2), (x0, y1 - sk), (x0, y1), (0, h)], fill=pal.skirting)
    d.polygon([(w, h - sk * 2), (x1, y1 - sk), (x1, y1), (w, h)], fill=pal.skirting)

    # Window on the back wall: frame in the accent colour, light-filled glass.
    ww = round((x1 - x0) * 0.22)
    wx0 = x0 + round((x1 - x0) * 0.06)
    wy0 = y0 + round((y1 - y0) * 0.16)
    wy1 = y0 + round((y1 - y0) * 0.62)
    frame = max(2, ww // 14)
    d.rectangle(
        [wx0 - frame, wy0 - frame, wx0 + ww + frame, wy1 + frame], fill=pal.accent
    )
    d.rectangle([wx0, wy0, wx0 + ww, wy1], fill=pal.window_light)
    d.line([(wx0 + ww // 2, wy0), (wx0 + ww // 2, wy1)], fill=pal.accent, width=frame)
    d.line(
        [(wx0, (wy0 + wy1) // 2), (wx0 + ww, (wy0 + wy1) // 2)],
        fill=pal.accent,
        width=frame,
    )
    return im


def soft_shadow(
    canvas: Image.Image, cx: int, base_y: int, width: int, strength: int = 90
) -> None:
    """Blurred dark ellipse under a piece, composited onto the canvas in place."""
    pad = max(6, width // 4)
    layer = Image.new("L", (width + pad * 2, pad * 2 + 4), 0)
    ImageDraw.Draw(layer).ellipse(
        [pad // 2, pad // 2, width + pad * 3 // 2, pad * 2 - pad // 2], fill=strength
    )
    layer = layer.filter(ImageFilter.GaussianBlur(max(2, pad // 3)))
    black = Image.new("RGB", layer.size, (0, 0, 0))
    canvas.paste(black, (cx - layer.width // 2, base_y - layer.height // 2), layer)
