"""Synthetic workbooks only: fast tests never read the real supplier files."""

import csv
from pathlib import Path

import pytest
from openpyxl import Workbook

from curalina_recommendation.consultation.catalogue import (
    CatalogueNotFoundError,
    load_catalogue,
)

CELADON_HEADER = [
    "SKU",
    "Product Name",
    "Retail Price",
    "Room Type",
    "Design Style",
    "Atmosphere",
    "Width (in)",
    "Height (in)",
]
FURNITURE_HEADER = [
    "Supplier SKU",
    "Product Name",
    "Product Type",
    "Retail Price",
    "Room Type",
    "Design Style",
    "Atmosphere",
    "Practical Touches",
    "Width (in)",
    "Depth (in)",
    "Height (in)",
]


def _xlsx(path: Path, header: list[str], rows: list[list[object]]) -> None:
    wb = Workbook()
    ws = wb.active
    ws.append(header)
    for row in rows:
        ws.append(row)
    ws.append([None] * len(header))  # trailing empty rows are trimmed
    wb.save(path)


def _folder(tmp_path: Path) -> Path:
    _xlsx(
        tmp_path / "Celadon CSV Programmer Handoff.xlsx",
        CELADON_HEADER,
        [
            [
                21368,
                "Traverse I",
                1072.5,
                "Living Room; Bedroom",
                "Organic Modern",
                "Bright & Airy",
                59,
                43,
            ],
        ],
    )
    _xlsx(
        tmp_path / "Lazzoni CSV Programmer Handoff.xlsx",
        FURNITURE_HEADER,
        [
            [
                None,
                "STONE T NIGHTSTAND",
                "Nightstand",
                "$1,895 / $1,963",
                "Bedroom",
                "Organic Modern",
                "Warm & Balanced",
                "Storage to keep everything tidy",
                20,
                18,
                22,
            ],
            [
                None,
                None,
                None,
                None,
                None,
                None,
                None,
                None,
                None,
                None,
                None,
            ],  # interior blank row
            [
                None,
                "ENA CHAIR",
                "Dining Chair",
                1393,
                "Dining Room",
                "Contemporary Luxe",
                "Dark & Moody",
                "Refined space for hosting and socializing",
                "21",
                "22",
                "30",
            ],
        ],
    )
    _xlsx(
        tmp_path / "Luxus Programmer Handoff.xlsx",
        FURNITURE_HEADER,
        [
            [
                None,
                "Raya Dining Table",
                "Dining Table",
                13857.5,
                "Dining Room",
                "Organic Modern",
                "Birght & Airy",
                "Refined space for hosting and socializing; Seating: 8",
                96,
                42,
                30,
            ],
            [
                None,
                "Pomme Bed - King",
                "Bed",
                0,
                "Bedroom",
                "Organic Modern",
                "Warm & Balanced",
                "Cozy, relaxing space for everyday comfort; King Size Bed",
                80,
                90,
                50,
            ],
            [
                None,
                "No Tags Sofa",
                "Sofa",
                5000,
                None,
                "Organic Modern",
                "Warm & Balanced",
                None,
                1,
                1,
                1,
            ],
        ],
    )
    return tmp_path


def test_loads_all_suppliers_with_row_based_ids(tmp_path: Path) -> None:
    catalogue = load_catalogue(_folder(tmp_path))
    ids = [p.product_id for p in catalogue.products]
    assert ids == [
        "Celadon:21368",
        "Lazzoni:row2",
        "Lazzoni:row4",
        "Luxus:row2",
        "Luxus:row3",
    ]


def test_cleaning_is_reported(tmp_path: Path) -> None:
    catalogue = load_catalogue(_folder(tmp_path))
    report = catalogue.report
    assert report.rows_loaded == 7  # 1 Celadon + 3 Lazzoni (one blank) + 3 Luxus
    assert report.dropped_no_category_or_name == 1
    assert report.dropped_no_tags == 1
    assert report.tag_fixes == {"Birght & Airy -> Bright & Airy": 1}
    assert report.unparsed_prices == {"$1,895 / $1,963": 1}
    assert len(report.fingerprint) == 64


def test_fields(tmp_path: Path) -> None:
    by_id = {p.product_id: p for p in load_catalogue(_folder(tmp_path)).products}
    art = by_id["Celadon:21368"]
    assert art.category == "Wall Art"
    assert art.rooms == ("Living Room", "Bedroom")
    assert art.depth_in is None
    table = by_id["Luxus:row2"]
    assert table.atmospheres == ("Bright & Airy",)
    assert table.touches == ("Refined space for hosting and socializing",)
    assert table.seating == 8
    bed = by_id["Luxus:row3"]
    assert bed.bed_size == "King Size Bed"
    assert bed.price is None  # 0 is missing, not free
    assert by_id["Lazzoni:row2"].price is None  # two prices: ambiguous, not guessed
    assert by_id["Lazzoni:row4"].width_in == 21.0  # numeric strings parse


def test_missing_supplier_fails_closed(tmp_path: Path) -> None:
    folder = _folder(tmp_path)
    (folder / "Luxus Programmer Handoff.xlsx").unlink()
    with pytest.raises(CatalogueNotFoundError, match="Luxus"):
        load_catalogue(folder)


def test_missing_folder_fails_closed(tmp_path: Path) -> None:
    with pytest.raises(CatalogueNotFoundError):
        load_catalogue(tmp_path / "nope")


def test_csv_exports_are_accepted(tmp_path: Path) -> None:
    folder = _folder(tmp_path)
    (folder / "Celadon CSV Programmer Handoff.xlsx").unlink()
    with (folder / "Celadon export.csv").open("w", newline="", encoding="utf-8") as fh:
        writer = csv.writer(fh)
        writer.writerow(CELADON_HEADER)
        writer.writerow(
            [
                "23300",
                "Botanical in Umber I",
                "648",
                "Dining Room",
                "Organic Modern",
                "Dark & Moody",
                "30",
                "40",
            ]
        )
    products = load_catalogue(folder).products
    art = next(p for p in products if p.supplier == "Celadon")
    assert art.product_id == "Celadon:23300"
    assert art.price == 648.0
