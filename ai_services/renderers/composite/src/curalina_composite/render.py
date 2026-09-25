"""Piece selection, scaling, depth-ordered placement and PNG encoding."""

from __future__ import annotations

import hashlib
import io
import random
from dataclasses import dataclass
from pathlib import Path

from PIL import Image

from .catalogue import ART, Product, scan
from .palette import UnsupportedBrief, palette_for
from .scene import BACK_LEFT, BACK_RIGHT, Geometry, draw_shell, soft_shadow

# Approximate real-world widths in mm. Illustrative only, not to scale: they
# just keep a sofa larger than a side table. Real dimensions are not used.
NOMINAL_WIDTH_MM: dict[str, int] = {
    "sofa": 2100,
    "sectional": 2800,
    "accent_chair": 800,
    "coffee_table": 1100,
    "side_table": 500,
    "ottoman": 600,
    "bench": 1200,
    "bed": 1900,
    "nightstand": 550,
    "dining_table": 1800,
    "dining_chair": 480,
    "sideboard": 1600,
    "bar_cabinet": 900,
    ART: 900,
}
# The back wall is assumed to be ~4.2 m wide; pieces nearer the viewer are
# scaled up by up to FRONT_SCALE (a crude perspective approximation).
ROOM_WIDTH_MM = 4200
FRONT_SCALE = 1.5
MAX_HEIGHT_FRACTION = 0.6


@dataclass(frozen=True)
class Slot:
    categories: tuple[str, ...]  # first non-empty category wins
    x: float  # horizontal centre, fraction of canvas width
    depth: float  # 0 = against the back wall, 1 = nearest the viewer


_LAYOUTS: dict[str, tuple[Slot, ...]] = {
    "living room": (
        Slot(("sofa", "sectional"), 0.50, 0.12),
        Slot(("accent_chair",), 0.20, 0.55),
        Slot(("coffee_table",), 0.50, 0.50),
        Slot(("side_table",), 0.82, 0.14),
        Slot((ART,), 0.50, -1.0),
    ),
    "bedroom": (
        Slot(("bed",), 0.50, 0.10),
        Slot(("nightstand",), 0.24, 0.08),
        Slot(("nightstand",), 0.76, 0.08),
        Slot(("bench",), 0.50, 0.50),
        Slot((ART,), 0.50, -1.0),
    ),
    "dining room": (
        Slot(("sideboard",), 0.50, 0.06),
        Slot(("dining_table",), 0.50, 0.50),
        Slot(("dining_chair",), 0.36, 0.38),
        Slot(("dining_chair",), 0.64, 0.38),
        Slot(("dining_chair",), 0.36, 0.72),
        Slot(("dining_chair",), 0.64, 0.72),
        Slot((ART,), 0.50, -1.0),
    ),
}


@dataclass
class Placement:
    product: Product
    image: Image.Image  # resized RGBA, original pixels otherwise untouched
    left: int
    top: int
    base_y: int
    cx: int
    is_art: bool


@dataclass(frozen=True)
class RenderResult:
    png: bytes
    pieces: list[str]


class NoCatalogueImages(Exception):
    pass


def resolve_seed(seed: int | None, prompt: str) -> int:
    if seed is not None:
        return seed
    return int.from_bytes(hashlib.sha256(prompt.encode("utf-8")).digest()[:8], "big")


def prepare_cutout(img: Image.Image, target_width: int, max_height: int) -> Image.Image:
    """Crop transparent margins (pure crop) then resize. Pixels are never edited."""
    rgba = img.convert("RGBA")
    box = rgba.getchannel("A").getbbox()
    if box is not None:
        rgba = rgba.crop(box)
    ratio = rgba.height / rgba.width
    w = max(1, target_width)
    h = max(1, round(w * ratio))
    if h > max_height:
        h = max_height
        w = max(1, round(h / ratio))
    return rgba.resize((w, h), Image.Resampling.LANCZOS)


def _is_usable(img: Image.Image, is_art: bool) -> bool:
    if img.width < 2 or img.height < 2:
        return False
    if is_art:
        return True
    # A furniture "cutout" with no transparency at all is not a cutout.
    alpha = img.convert("RGBA").getchannel("A")
    return min(alpha.tobytes()) < 255


def _load(product: Product, is_art: bool) -> Image.Image | None:
    try:
        with Image.open(product.image_path) as im:
            im.load()
            loaded = im.convert("RGBA")
    except (OSError, ValueError):
        return None
    return loaded if _is_usable(loaded, is_art) else None


def _choose(
    catalogue: dict[str, list[Product]],
    slot: Slot,
    index: int,
    seed: int,
    used: set[str],
) -> tuple[Product, Image.Image] | None:
    for category in slot.categories:
        candidates = [p for p in catalogue.get(category, []) if p.name not in used]
        if not candidates:
            candidates = list(catalogue.get(category, []))
        rng = random.Random(f"{seed}:{index}:{category}")
        rng.shuffle(candidates)  # deterministic order for this seed
        for product in candidates:
            loaded = _load(product, category == ART)
            if loaded is not None:
                return product, loaded
    return None


def build_placements(
    catalogue: dict[str, list[Product]], room_type: str, geo: Geometry, seed: int
) -> list[Placement]:
    layout = _LAYOUTS.get(" ".join(room_type.lower().split()))
    if layout is None:
        raise UnsupportedBrief(
            "unsupported_room_type", f"unsupported room_type: {room_type!r}"
        )
    back_w = (BACK_RIGHT - BACK_LEFT) * geo.width
    ppm_back = back_w / ROOM_WIDTH_MM
    floor_span = geo.height - geo.by1
    used: set[str] = set()
    placements: list[Placement] = []
    for index, slot in enumerate(layout):
        picked = _choose(catalogue, slot, index, seed, used)
        if picked is None:
            continue
        product, loaded = picked
        used.add(product.name)
        is_art = product.category == ART
        cx = round(slot.x * geo.width)
        if is_art:
            scale = ppm_back
            target_w = round(NOMINAL_WIDTH_MM[ART] * scale)
            cut = prepare_cutout(loaded, target_w, round((geo.by1 - geo.by0) * 0.45))
            top = geo.by0 + round((geo.by1 - geo.by0) * 0.12)
            placements.append(
                Placement(
                    product, cut, cx - cut.width // 2, top, top + cut.height, cx, True
                )
            )
            continue
        scale = ppm_back * (1 + (FRONT_SCALE - 1) * slot.depth)
        target_w = round(NOMINAL_WIDTH_MM[product.category] * scale)
        cut = prepare_cutout(loaded, target_w, round(geo.height * MAX_HEIGHT_FRACTION))
        base_y = (
            geo.by1 + round(floor_span * 0.85 * slot.depth) + round(floor_span * 0.06)
        )
        placements.append(
            Placement(
                product,
                cut,
                cx - cut.width // 2,
                base_y - cut.height,
                base_y,
                cx,
                False,
            )
        )
    # Depth ordering: wall art first, then furniture back-to-front by base line.
    placements.sort(key=lambda p: (not p.is_art, p.base_y))
    return placements


def render_room(
    images_dir: Path,
    room_type: str,
    style: str,
    atmosphere: str,
    width: int,
    height: int,
    seed: int | None,
    prompt: str,
) -> RenderResult:
    pal = palette_for(atmosphere, style)
    geo = Geometry(width, height)
    placements = build_placements(
        scan(images_dir), room_type, geo, resolve_seed(seed, prompt)
    )
    if not placements:
        raise NoCatalogueImages(f"no usable catalogue images under {images_dir}")
    canvas = draw_shell(geo, pal)
    for p in placements:
        if not p.is_art:
            soft_shadow(canvas, p.cx, p.base_y, p.image.width)
        canvas.paste(p.image, (p.left, p.top), p.image)
    buf = io.BytesIO()
    canvas.save(buf, format="PNG")
    return RenderResult(buf.getvalue(), [p.product.name for p in placements])
