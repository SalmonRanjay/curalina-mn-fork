"""Unit tests for the real `XlsxCatalogueImporter` adapter.

Each test writes a tiny synthetic `.xlsx` (via `openpyxl`, not the real
`attached_assets` workbook) shaped like the pinned file's 36-column
layout, exercising exactly the column-union and rejection rules ADR-0005
specifies. The real pinned file is exercised by the R01 notebook itself,
not by this offline suite.
"""

from __future__ import annotations

from pathlib import Path

import openpyxl
import pytest

from curalina_recommendation.adapters.xlsx_catalogue_importer import (
    XlsxCatalogueImporter,
)
from curalina_recommendation.adapters.xlsx_parsing import UNCONFIRMED_CURRENCY
from curalina_recommendation.domain.eligibility import Availability

_HEADER = [f"col{i}" for i in range(36)]


def _row(
    *,
    name: str = "Test Product",
    supplier: str = "Four Hands",
    sku: str = "SKU-1",
    retail_price: object = 100,
    category: str = "Sofa",
    dims_moes: object = None,
    dims_four_hands: object = None,
    source_file: str = "Four Hands Sofas.xlsx",
) -> list[object]:
    row = [None] * 36
    row[0] = name
    row[2] = supplier
    row[3] = sku
    row[5] = retail_price
    row[6] = category
    row[11] = dims_moes
    row[29] = dims_four_hands
    row[27] = source_file
    return row


def _write_workbook(tmp_path: Path, rows: list[list[object]]) -> Path:
    workbook = openpyxl.Workbook()
    sheet = workbook.active
    sheet.append(_HEADER)
    for row in rows:
        sheet.append(row)
    path = tmp_path / "workbook.xlsx"
    workbook.save(path)
    return path


def test_imports_matching_supplier_only(tmp_path: Path) -> None:
    path = _write_workbook(
        tmp_path,
        [
            _row(
                sku="FH-1",
                supplier="Four Hands",
                dims_four_hands='30"w x 20"d x 40"h',
            ),
            _row(sku="MH-1", supplier="Moes Home", dims_moes="10” W X 12” D X 14” H"),
        ],
    )
    importer = XlsxCatalogueImporter()

    snapshot = importer.import_catalogue(source_uri=str(path), supplier_id="Four Hands")

    assert snapshot.supplier_id == "Four Hands"
    assert [p.key.normalized_sku for p in snapshot.products] == ["FH-1"]
    assert snapshot.report.products_seen == 1
    assert snapshot.report.products_imported == 1
    assert snapshot.report.products_rejected == 0


def test_duplicate_supplier_sku_pair_is_rejected_not_raised(tmp_path: Path) -> None:
    path = _write_workbook(
        tmp_path,
        [
            _row(
                sku="DUP-1",
                supplier="Moes Home",
                source_file="Moes Home Accent and Side Tables.xlsx",
            ),
            _row(
                sku="DUP-1",
                supplier="Moes Home",
                source_file="Four Hands Coffee Tables.xlsx",
            ),
        ],
    )
    importer = XlsxCatalogueImporter()

    snapshot = importer.import_catalogue(source_uri=str(path), supplier_id="Moes Home")

    assert len(snapshot.products) == 1
    assert snapshot.report.products_seen == 2
    assert snapshot.report.products_imported == 1
    assert snapshot.report.products_rejected == 1
    assert snapshot.report.rejected_reasons == ("duplicate_product_key",)


def test_blank_category_row_is_rejected_not_raised(tmp_path: Path) -> None:
    path = _write_workbook(tmp_path, [_row(sku="NOCAT-1", category="")])
    importer = XlsxCatalogueImporter()

    snapshot = importer.import_catalogue(source_uri=str(path), supplier_id="Four Hands")

    assert snapshot.products == ()
    assert snapshot.report.products_rejected == 1
    assert snapshot.report.rejected_reasons == ("missing_category",)


def test_blank_sku_row_is_rejected_as_invalid_sku(tmp_path: Path) -> None:
    path = _write_workbook(tmp_path, [_row(sku="   ")])
    importer = XlsxCatalogueImporter()

    snapshot = importer.import_catalogue(source_uri=str(path), supplier_id="Four Hands")

    assert snapshot.report.rejected_reasons == ("invalid_sku",)


def test_primary_category_takes_first_of_multi_value_cell(tmp_path: Path) -> None:
    path = _write_workbook(
        tmp_path, [_row(sku="MULTI-1", category="End Table, Nightstand")]
    )
    importer = XlsxCatalogueImporter()

    snapshot = importer.import_catalogue(source_uri=str(path), supplier_id="Four Hands")

    assert snapshot.products[0].category == "End Table"


def test_price_uses_decimal_and_unconfirmed_currency_sentinel(tmp_path: Path) -> None:
    path = _write_workbook(tmp_path, [_row(sku="PRICE-1", retail_price=1299)])
    importer = XlsxCatalogueImporter()

    snapshot = importer.import_catalogue(source_uri=str(path), supplier_id="Four Hands")

    price = snapshot.products[0].price
    assert price is not None
    assert price.currency == UNCONFIRMED_CURRENCY
    from decimal import Decimal

    assert price.amount == Decimal("1299")


def test_dimensions_union_prefers_moes_column_when_present(tmp_path: Path) -> None:
    path = _write_workbook(
        tmp_path,
        [_row(sku="DIM-1", dims_moes="10” W X 12” D X 14” H", dims_four_hands=None)],
    )
    importer = XlsxCatalogueImporter()

    snapshot = importer.import_catalogue(source_uri=str(path), supplier_id="Four Hands")

    dims = snapshot.products[0].dimensions
    assert dims is not None
    assert int(dims.width_mm) == round(10 * 25.4)


def test_unparseable_dimensions_leave_product_dimensionless_not_rejected(
    tmp_path: Path,
) -> None:
    path = _write_workbook(
        tmp_path, [_row(sku="NODIM-1", dims_moes=None, dims_four_hands=None)]
    )
    importer = XlsxCatalogueImporter()

    snapshot = importer.import_catalogue(source_uri=str(path), supplier_id="Four Hands")

    assert len(snapshot.products) == 1
    assert snapshot.products[0].dimensions is None


def test_availability_is_always_unknown(tmp_path: Path) -> None:
    path = _write_workbook(tmp_path, [_row(sku="AVAIL-1")])
    importer = XlsxCatalogueImporter()

    snapshot = importer.import_catalogue(source_uri=str(path), supplier_id="Four Hands")

    assert snapshot.products[0].availability is Availability.UNKNOWN


def test_source_file_is_never_used_for_supplier_attribution(tmp_path: Path) -> None:
    # A Moe's Home row whose Source File names a Four Hands sheet must
    # still be imported as Moe's Home when requested by supplier_id,
    # never silently reattributed via column 27.
    path = _write_workbook(
        tmp_path,
        [
            _row(
                sku="MISLABEL-1",
                supplier="Moes Home",
                source_file="Four Hands Coffee Tables.xlsx",
            )
        ],
    )
    importer = XlsxCatalogueImporter()

    snapshot = importer.import_catalogue(source_uri=str(path), supplier_id="Moes Home")

    assert len(snapshot.products) == 1
    assert snapshot.products[0].key.supplier_id == "Moes Home"


@pytest.mark.parametrize("supplier_id", ["Four Hands", "Moes Home"])
def test_two_suppliers_in_one_file_require_two_import_calls(
    tmp_path: Path, supplier_id: str
) -> None:
    path = _write_workbook(
        tmp_path,
        [
            _row(sku="FH-1", supplier="Four Hands"),
            _row(sku="MH-1", supplier="Moes Home"),
        ],
    )
    importer = XlsxCatalogueImporter()

    snapshot = importer.import_catalogue(source_uri=str(path), supplier_id=supplier_id)

    assert snapshot.supplier_id == supplier_id
    assert all(p.key.supplier_id == supplier_id for p in snapshot.products)
