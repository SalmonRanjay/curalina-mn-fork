"""Raw `.xlsx` row reader for the combined Four Hands / Moe's workbook.

This is the one place `openpyxl` touches disk. Everything downstream
(`xlsx_catalogue_importer`, `application.catalogue_audit_service`) consumes
the plain `tuple[object, ...]` rows this module returns — no `DataFrame`
crosses into the domain layer, and no other module opens the workbook
file directly.

Per ADR-0005, the workbook is read with `read_only=True, data_only=True`
so formulas resolve to their last-computed value rather than the formula
string.
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass
from pathlib import Path

import openpyxl


@dataclass(frozen=True, slots=True)
class WorkbookRows:
    """The raw contents of one worksheet: a header row plus data rows.

    `rows` excludes the header and excludes fully-empty rows (a blank
    trailing row is a formatting artefact, not a data row per
    `02_local_setup.md`: "Worksheet dimensions include blank/formatted
    rows; do not use max_row as a product count").
    """

    source_path: Path
    source_md5: str
    sheet_name: str
    header: tuple[str, ...]
    rows: tuple[tuple[object, ...], ...]


def file_md5(path: Path | str) -> str:
    """Hash the workbook bytes so every notebook run can pin the exact
    input version it audited (ADR-0005's `md5 prefix 3ad1f5d7`)."""

    digest = hashlib.md5()
    with Path(path).open("rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def read_workbook_rows(
    path: Path | str, *, sheet_name: str | None = None
) -> WorkbookRows:
    """Read one worksheet's header and non-empty data rows.

    `sheet_name` defaults to the workbook's only/first sheet (the pinned
    file has a single `Sheet1`); passing it explicitly makes an
    unexpected multi-sheet input file fail loudly via `KeyError` rather
    than silently reading the wrong sheet.
    """

    path = Path(path)
    workbook = openpyxl.load_workbook(path, read_only=True, data_only=True)
    try:
        sheet = workbook[sheet_name] if sheet_name else workbook[workbook.sheetnames[0]]
        all_rows = list(sheet.iter_rows(values_only=True))
    finally:
        workbook.close()
    if not all_rows:
        raise ValueError(f"{path} sheet is empty (no header row)")
    header = tuple(str(h) if h is not None else "" for h in all_rows[0])
    data_rows = tuple(
        row for row in all_rows[1:] if any(cell is not None for cell in row)
    )
    return WorkbookRows(
        source_path=path,
        source_md5=file_md5(path),
        sheet_name=sheet.title,
        header=header,
        rows=data_rows,
    )
