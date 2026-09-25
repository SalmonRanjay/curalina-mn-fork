"""Scan the mounted supplier directory and classify products by name.

Layout (read-only):
  LUXUS/Product Images/<NNN - Product Name>/*.png   transparent furniture cutouts
  CELADON/<NNN - Title - SKU>/*.png                 flat framed artwork (wall art)
ATRIANI (white-background webp) is deliberately ignored: no background removal.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path

ART = "art"

# Order matters: more specific phrases first. Matched on the lower-cased name.
_CATEGORY_PATTERNS: tuple[tuple[str, str], ...] = (
    ("dining_chair", r"dining chair"),
    ("dining_table", r"dining table"),
    ("accent_chair", r"accent chair|armchair|lounge chair"),
    ("coffee_table", r"coffee table|cocktail table"),
    ("side_table", r"side table|end table"),
    ("bar_cabinet", r"bar cabinet"),
    ("sectional", r"sectional"),
    ("sofa", r"\bsofa\b|\bloveseat\b"),
    ("ottoman", r"ottoman"),
    ("bench", r"\bbench\b"),
    ("nightstand", r"night ?stand|bedside"),
    ("bed", r"\bbed\b"),
    ("sideboard", r"sideboard|\bbuffet\b|credenza"),
)


@dataclass(frozen=True)
class Product:
    name: str  # stable display id, e.g. "LUXUS/001 - Sofa"
    category: str
    image_path: Path


def classify(product_name: str) -> str | None:
    lowered = product_name.lower()
    for category, pattern in _CATEGORY_PATTERNS:
        if re.search(pattern, lowered):
            return category
    return None


def _first_png(directory: Path) -> Path | None:
    pngs = sorted(p for p in directory.iterdir() if p.suffix.lower() == ".png")
    return pngs[0] if pngs else None


def _subdirs(root: Path) -> list[Path]:
    if not root.is_dir():
        return []
    return sorted(p for p in root.iterdir() if p.is_dir())


def scan(images_dir: Path) -> dict[str, list[Product]]:
    """Return products by category, each list sorted by name (deterministic)."""
    found: dict[str, list[Product]] = {}
    for d in _subdirs(images_dir / "LUXUS" / "Product Images"):
        category = classify(d.name)
        png = _first_png(d)
        if category and png:
            found.setdefault(category, []).append(
                Product(f"LUXUS/{d.name}", category, png)
            )
    for d in _subdirs(images_dir / "CELADON"):
        png = _first_png(d)
        if png:
            found.setdefault(ART, []).append(Product(f"CELADON/{d.name}", ART, png))
    return found
