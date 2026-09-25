"""Remove a near-white studio background from a catalogue photo.

Supplier furniture photos are white-background shots, some with a
semi-transparent white halo and some fully opaque. Compositing them as-is
leaves white boxes in the room. The background is whatever near-white area is
connected to the image border (flood fill from the border), so white parts
inside the product (e.g. a white sofa) are kept. Only the alpha channel
changes; every kept pixel's colour is the source colour.
"""

from __future__ import annotations

import numpy as np
from PIL import Image, ImageDraw

_MARKER = (255, 0, 255)
# Matte at roughly the size we paste at: PIL's flood fill is pure Python.
_MAX_SIDE = 700


def matte_white_background(img: Image.Image, tolerance: int = 28) -> Image.Image:
    rgba = img.convert("RGBA")
    if max(rgba.size) > _MAX_SIDE:
        rgba.thumbnail((_MAX_SIDE, _MAX_SIDE), Image.Resampling.LANCZOS)
    flat = Image.alpha_composite(
        Image.new("RGBA", rgba.size, (255, 255, 255, 255)), rgba
    ).convert("RGB")
    work = flat.copy()
    w, h = work.size
    seeds = [
        (0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1),
        (w // 2, 0), (w // 2, h - 1), (0, h // 2), (w - 1, h // 2),
    ]
    floor = 255 - tolerance
    for seed in seeds:
        px = flat.getpixel(seed)
        if isinstance(px, tuple) and all(int(c) >= floor for c in px[:3]):
            ImageDraw.floodfill(work, seed, _MARKER, thresh=tolerance)
    arr = np.array(rgba)
    background = np.all(np.array(work) == np.array(_MARKER), axis=2)
    arr[..., 3][background] = 0
    arr[..., 3][arr[..., 3] < 40] = 0
    return Image.fromarray(arr, "RGBA")
