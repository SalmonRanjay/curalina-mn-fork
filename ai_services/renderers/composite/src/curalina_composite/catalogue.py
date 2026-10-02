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
from typing import Protocol

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
    product_id: str | None = None  # set when a request named this piece


class Requested(Protocol):
    product_id: str
    name: str
    supplier: str
    category: str
    sku: str | None


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


def _norm(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", text.lower()).strip()


def _title(folder_name: str) -> str:
    """'012 - Raya Dining Table' -> 'Raya Dining Table'."""
    return re.sub(r"^\d+\s*-\s*", "", folder_name)


def _requested_category(category: str) -> str | None:
    return ART if _norm(category) == "wall art" else classify(category)


def _luxus_folder(name: str, category: str, folders: list[Path]) -> Path | None:
    """Exact (normalised) title, else the longest title the product name starts
    with ('Adana Sofa - 1A2 (R/L)' -> 'Adana Sofa'), but never a folder whose
    own name classifies as a different kind of furniture."""
    wanted = _norm(name)
    by_title = {_norm(_title(d.name)): d for d in folders}
    if wanted in by_title:
        return by_title[wanted]
    prefixes = sorted(
        (t for t in by_title if t and wanted.startswith(t + " ")), key=len, reverse=True
    )
    for title in prefixes:
        folder_kind = classify(title)
        if folder_kind is None or _same_kind(folder_kind, category):
            return by_title[title]
    return None


# Kinds the suppliers use interchangeably for one piece (Luxus types its
# Adana range "Sectional / Modular Sofa" while the image folder says "Sofa").
_INTERCHANGEABLE: tuple[frozenset[str], ...] = (frozenset({"sofa", "sectional"}),)


def _same_kind(a: str, b: str) -> bool:
    return a == b or any(a in group and b in group for group in _INTERCHANGEABLE)


def _celadon_folder(sku: str | None, name: str, folders: list[Path]) -> Path | None:
    for d in folders:
        if sku and d.name.rstrip().endswith(f"- {sku}"):
            return d
    wanted = _norm(name)
    return next(
        (d for d in folders if wanted and _norm(d.name).find(wanted) >= 0), None
    )


def resolve_single(
    images_dir: Path, supplier: str, name: str, sku: str | None = None
) -> Product | None:
    """Resolve one product's cutout by supplier + name, reusing the same
    folder-matching rules as `resolve_requested` (no category is known here,
    so it is inferred from the name itself via `classify`).

    Suppliers other than LUXUS/CELADON (e.g. Lazzoni, which ships no product
    photos) always resolve to None.
    """
    supplier_norm = supplier.strip().upper()
    folder: Path | None = None
    if supplier_norm == "LUXUS":
        category = classify(name)
        if category is not None:
            luxus = _subdirs(images_dir / "LUXUS" / "Product Images")
            folder = _luxus_folder(name, category, luxus)
    elif supplier_norm == "CELADON":
        celadon = _subdirs(images_dir / "CELADON")
        folder = _celadon_folder(sku, name, celadon)
    png = _first_png(folder) if folder is not None else None
    if folder is None or png is None:
        return None
    category = ART if supplier_norm == "CELADON" else classify(folder.name) or ""
    return Product(f"{supplier_norm}/{folder.name}", category, png)


def resolve_requested(
    images_dir: Path, requested: list[Requested]
) -> tuple[list[Product], list[str]]:
    """Find the cutout for each requested product. Returns (found, missing ids).

    Only LUXUS cutouts and CELADON artwork exist; anything else (e.g. Lazzoni,
    which ships PDF spec sheets only) is reported missing, never substituted.
    """
    luxus = _subdirs(images_dir / "LUXUS" / "Product Images")
    celadon = _subdirs(images_dir / "CELADON")
    found: list[Product] = []
    missing: list[str] = []
    for item in requested:
        category = _requested_category(item.category)
        supplier = item.supplier.strip().upper()
        folder: Path | None = None
        if category is not None and supplier == "LUXUS":
            folder = _luxus_folder(item.name, category, luxus)
        elif category == ART and supplier == "CELADON":
            folder = _celadon_folder(item.sku, item.name, celadon)
        png = _first_png(folder) if folder is not None else None
        if category is None or folder is None or png is None:
            missing.append(item.product_id)
            continue
        found.append(
            Product(f"{supplier}/{folder.name}", category, png, item.product_id)
        )
    return found, missing
