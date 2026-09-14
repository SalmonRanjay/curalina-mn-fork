"""Extracts the label-source fields (`Room Type`, `Design Style`, `Tags`,
`Furniture Category`, `Supplier`, price) from the pinned Four Hands / Moe's
Home workbook, for R02 label derivation only.

This module is never imported by `domain/`, `ports/`, or any
`FeatureEncoder` adapter. ADR-0006 §D2's firewall requires the
label-source columns to be structurally unreachable from ranking code;
keeping this reader confined to `evaluation/` is how that is enforced on
the label-construction side (the domain-level firewall test at
`tests/unit/domain/test_product.py::test_product_carries_no_label_source_fields`
covers the `Product`/encoder side).
"""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal

from curalina_recommendation.adapters.xlsx_parsing import (
    COL_CATEGORY,
    COL_DESIGN_STYLE,
    COL_RETAIL_PRICE,
    COL_ROOM_TYPE,
    COL_SUPPLIER,
    COL_TAGS,
    DIMENSIONS_COLS,
    first_non_blank,
    parse_dimensions_inches,
    parse_money_decimal,
)
from curalina_recommendation.adapters.xlsx_workbook_reader import read_workbook_rows
from curalina_recommendation.domain.errors import InvalidSkuError
from curalina_recommendation.domain.product import ProductKey

_COL_SKU = 3


def _slugify(value: str) -> str:
    return "-".join(value.strip().lower().split())


def _split_multi(raw: object) -> tuple[str, ...]:
    if not isinstance(raw, str) or not raw.strip():
        return ()
    return tuple(part.strip() for part in raw.split(",") if part.strip())


@dataclass(frozen=True, slots=True)
class LabelSourceRecord:
    """One catalogue row's label-basis fields, keyed by the same
    `product_id` the real `XlsxCatalogueImporter` assigns, so labels join
    against the `Product` objects a `FeatureEncoder` ranks."""

    product_id: str
    supplier_id: str
    price: Decimal | None
    width_in: Decimal | None
    room_types_raw: tuple[str, ...]
    design_styles_raw: tuple[str, ...]
    tags_raw: tuple[str, ...]
    categories_raw: tuple[str, ...]


def read_label_source_records(source_uri: str) -> tuple[LabelSourceRecord, ...]:
    workbook = read_workbook_rows(source_uri)
    records: list[LabelSourceRecord] = []
    for row in workbook.rows:
        raw_supplier = row[COL_SUPPLIER] if len(row) > COL_SUPPLIER else None
        if not isinstance(raw_supplier, str) or not raw_supplier.strip():
            continue
        supplier_id = raw_supplier.strip()
        raw_sku = row[_COL_SKU] if len(row) > _COL_SKU else None
        try:
            key = ProductKey.build(supplier_id=supplier_id, raw_sku=str(raw_sku or ""))
        except InvalidSkuError:
            continue
        product_id = f"{_slugify(supplier_id)}:{key.normalized_sku}"
        price = parse_money_decimal(
            row[COL_RETAIL_PRICE] if len(row) > COL_RETAIL_PRICE else None
        )
        raw_dims = first_non_blank(
            *(row[c] if len(row) > c else None for c in DIMENSIONS_COLS)
        )
        parsed_dims = (
            parse_dimensions_inches(raw_dims) if raw_dims is not None else None
        )
        width_in = parsed_dims.width_in if parsed_dims is not None else None
        records.append(
            LabelSourceRecord(
                product_id=product_id,
                supplier_id=supplier_id,
                price=price,
                width_in=width_in,
                room_types_raw=_split_multi(
                    row[COL_ROOM_TYPE] if len(row) > COL_ROOM_TYPE else None
                ),
                design_styles_raw=_split_multi(
                    row[COL_DESIGN_STYLE] if len(row) > COL_DESIGN_STYLE else None
                ),
                tags_raw=_split_multi(row[COL_TAGS] if len(row) > COL_TAGS else None),
                categories_raw=_split_multi(
                    row[COL_CATEGORY] if len(row) > COL_CATEGORY else None
                ),
            )
        )
    return tuple(records)
