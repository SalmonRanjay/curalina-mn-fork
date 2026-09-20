"""ATRIANI corpus loading and exclusion for V01 (`ADR-0008`, `ADR-0012`).

Reads `Design 44.xlsx`'s `Linl to pictures ` column (sic — the typo is the
real header) as the sole allowlist of product folders — **never** a
directory glob across the corpus. Applies the `ADR-0008` hard exclusions
(two named synthetic files, `-150x150` thumbnails, a contamination-name
regex) and reports funnel counts at every stage, per `ADR-0012` §D7.

This module knows nothing about `/Users/rjsalmon/Downloads`. The caller (the
V01 notebook) resolves the notebook-scope `CURALINA_SOURCE_ASSETS_DIR` and
passes a `Path` in; this module is never imported by service runtime code
and never reads `Settings`.
"""

from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass
from pathlib import Path

import openpyxl

ALLOWLIST_SHEET = "design 44 product development"
ALLOWLIST_COLUMN = "Linl to pictures "  # sic, per ADR-0008
WORKBOOK_FILENAME = "Design 44.xlsx"

_CONTAMINATION_RE = re.compile(r"(?i)chatgpt|screenshot|midjourney|dall-?e|generated")
_THUMBNAIL_RE = re.compile(r"-150x150")


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    digest.update(path.read_bytes())
    return digest.hexdigest()


def is_excluded_filename(name: str) -> bool:
    """`ADR-0008` condition 3: contamination-name regex or a `-150x150`
    thumbnail suffix. Applied to every candidate file name, not only the two
    named files, so a repeat of the same contamination class is caught."""
    return bool(_CONTAMINATION_RE.search(name)) or bool(_THUMBNAIL_RE.search(name))


def load_allowlisted_folder_names(workbook_path: Path) -> tuple[str, ...]:
    """Distinct, order-preserving `Linl to pictures ` values from the
    manifest sheet. This is the entire allowlist — no directory is admitted
    that is not named here."""
    workbook = openpyxl.load_workbook(workbook_path, read_only=True, data_only=True)
    try:
        worksheet = workbook[ALLOWLIST_SHEET]
        rows = list(worksheet.iter_rows(values_only=True))
    finally:
        workbook.close()
    if len(rows) < 3:
        raise ValueError(
            f"{workbook_path} has fewer than 3 rows; expected a header row"
        )
    header = rows[1]
    if ALLOWLIST_COLUMN not in header:
        raise ValueError(
            f"column {ALLOWLIST_COLUMN!r} not found in {workbook_path} header"
        )
    column_index = header.index(ALLOWLIST_COLUMN)
    seen: dict[str, None] = {}
    for row in rows[2:]:
        if column_index >= len(row):
            continue
        value = row[column_index]
        if value is None:
            continue
        name = str(value).strip()
        if name and name != WORKBOOK_FILENAME:
            seen[name] = None
    return tuple(seen.keys())


def list_folder_files(folder: Path) -> tuple[Path, ...]:
    """Non-glob directory listing: every file directly inside `folder`."""
    if not folder.is_dir():
        return ()
    return tuple(sorted(p for p in folder.iterdir() if p.is_file()))


def candidate_product_images(folder: Path) -> tuple[Path, ...]:
    """`.webp` files in `folder` surviving the `ADR-0008` name exclusions."""
    return tuple(
        f
        for f in list_folder_files(folder)
        if f.suffix.lower() == ".webp" and not is_excluded_filename(f.name)
    )

def excluded_product_images(folder: Path) -> tuple[Path, ...]:
    """`.webp` files in `folder` dropped by the `ADR-0008` name exclusions —
    reported so exclusions are counted, never silently applied."""
    return tuple(
        f
        for f in list_folder_files(folder)
        if f.suffix.lower() == ".webp" and is_excluded_filename(f.name)
    )


def swatch_candidates(folder: Path) -> tuple[Path, ...]:
    """Non-`.webp`, non-manifest files in `folder` — candidate target-colour
    sources. These are never product images; `ADR-0012` D5.4 governs their
    admission separately."""
    return tuple(
        f
        for f in list_folder_files(folder)
        if f.suffix.lower() != ".webp" and f.name != WORKBOOK_FILENAME
    )


@dataclass(frozen=True, slots=True)
class FunnelCounts:
    """`ADR-0012` §D7's mandatory funnel: counts at every admission stage,
    reported before any pass rate."""

    folders_allowlisted: int
    folders_with_admitted_webp: int
    webp_seen_total: int
    webp_excluded_by_name: int
    webp_admitted: int


def compute_funnel(
    atriani_root: Path, allowed_folders: tuple[str, ...]
) -> FunnelCounts:
    seen = 0
    excluded = 0
    admitted_folders = 0
    for name in allowed_folders:
        folder = atriani_root / name
        admitted = candidate_product_images(folder)
        dropped = excluded_product_images(folder)
        seen += len(admitted) + len(dropped)
        excluded += len(dropped)
        if admitted:
            admitted_folders += 1
    return FunnelCounts(
        folders_allowlisted=len(allowed_folders),
        folders_with_admitted_webp=admitted_folders,
        webp_seen_total=seen,
        webp_excluded_by_name=excluded,
        webp_admitted=seen - excluded,
    )
