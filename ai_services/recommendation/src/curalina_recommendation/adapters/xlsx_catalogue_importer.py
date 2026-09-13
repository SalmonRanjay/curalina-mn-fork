"""`XlsxCatalogueImporter` — the real `CatalogueImporter` implementation.

Per `ports/catalogue_importer.py`'s docstring, this is workflow step 2 (A2),
unblocked for audit purposes by ADR-0005. It reads the pinned Four Hands /
Moe's workbook and returns one `CatalogueSnapshot` **per supplier**, because
the workbook merges two suppliers into a single sheet while
`CatalogueSnapshot.supplier_id` is singular — this importer resolves that
structural mismatch the way ADR-0005 expected: `import_catalogue` already
takes a `supplier_id` argument, so a caller imports each supplier
separately rather than `CatalogueSnapshot` gaining a multi-supplier shape.

This importer is deliberately conservative about what it upgrades to a
`Product`: it applies exactly the column mapping ADR-0005 verified, and
rejects (with a named reason, never a silent drop) anything that mapping
does not resolve. It does not attempt the OQ-009 attribute mapping — those
columns are recorded as present-but-unmapped, per the ADR.
"""

from __future__ import annotations

from collections import Counter
from dataclasses import dataclass

from curalina_recommendation.adapters.xlsx_parsing import (
    COL_CATEGORY,
    COL_NAME,
    COL_RETAIL_PRICE,
    COL_SKU,
    COL_SUPPLIER,
    DIMENSIONS_COLS,
    UNCONFIRMED_CURRENCY,
    first_non_blank,
    parse_dimensions_inches,
    parse_money_decimal,
    primary_category,
)
from curalina_recommendation.adapters.xlsx_workbook_reader import (
    WorkbookRows,
    read_workbook_rows,
)
from curalina_recommendation.domain.catalogue import (
    CatalogueImportReport,
    CatalogueSnapshot,
)
from curalina_recommendation.domain.dimensions import Dimensions
from curalina_recommendation.domain.eligibility import Availability
from curalina_recommendation.domain.errors import InvalidSkuError
from curalina_recommendation.domain.money import Money
from curalina_recommendation.domain.product import Product, ProductKey


def _slugify(value: str) -> str:
    return "-".join(value.strip().lower().split())


@dataclass(frozen=True, slots=True)
class XlsxCatalogueImporter:
    """Reads the pinned combined workbook and imports one supplier's rows.

    `source_uri` is the workbook path. `supplier_id` must match a value
    in column 2 (`Supplier`) verbatim (e.g. `"Four Hands"`, `"Moes Home"`)
    — column 27 (`Source File`) is never used for attribution, per
    ADR-0005 finding 3 (`Source File` mislabels 42 Moe's Home rows as
    Four Hands).
    """

    def import_catalogue(
        self, *, source_uri: str, supplier_id: str
    ) -> CatalogueSnapshot:
        workbook = read_workbook_rows(source_uri)
        snapshot_id = f"snap_{workbook.source_md5[:8]}_{_slugify(supplier_id)}"
        return self._import_from_rows(
            workbook=workbook, supplier_id=supplier_id, snapshot_id=snapshot_id
        )

    def _import_from_rows(
        self, *, workbook: WorkbookRows, supplier_id: str, snapshot_id: str
    ) -> CatalogueSnapshot:
        seen_keys: Counter[tuple[str, str]] = Counter()
        products: list[Product] = []
        products_seen = 0
        products_rejected = 0
        rejected_reasons: list[str] = []

        for row in workbook.rows:
            raw_supplier = row[COL_SUPPLIER] if len(row) > COL_SUPPLIER else None
            if not isinstance(raw_supplier, str) or raw_supplier.strip() != supplier_id:
                continue  # not this supplier's row at all; not "seen" for this import
            products_seen += 1

            raw_sku = row[COL_SKU] if len(row) > COL_SKU else None
            try:
                key = ProductKey.build(
                    supplier_id=supplier_id, raw_sku=str(raw_sku or "")
                )
            except InvalidSkuError:
                products_rejected += 1
                rejected_reasons.append("invalid_sku")
                continue

            dedup_key = (key.supplier_id, key.normalized_sku)
            seen_keys[dedup_key] += 1
            if seen_keys[dedup_key] > 1:
                products_rejected += 1
                rejected_reasons.append("duplicate_product_key")
                continue

            raw_category = row[COL_CATEGORY] if len(row) > COL_CATEGORY else None
            category = primary_category(raw_category)
            if category is None:
                products_rejected += 1
                rejected_reasons.append("missing_category")
                continue

            name = str(row[COL_NAME]) if row[COL_NAME] is not None else key.raw_sku
            price = self._build_price(row)
            dimensions = self._build_dimensions(row)
            product_id = f"{_slugify(supplier_id)}:{key.normalized_sku}"

            products.append(
                Product(
                    product_id=product_id,
                    key=key,
                    category=category,
                    name=name,
                    availability=Availability.UNKNOWN,
                    price=price,
                    dimensions=dimensions,
                    source_snapshot_id=snapshot_id,
                )
            )

        report = CatalogueImportReport(
            products_seen=products_seen,
            products_imported=len(products),
            products_rejected=products_rejected,
            rejected_reasons=tuple(rejected_reasons),
        )
        return CatalogueSnapshot(
            snapshot_id=snapshot_id,
            supplier_id=supplier_id,
            products=tuple(products),
            report=report,
        )

    @staticmethod
    def _build_price(row: tuple[object, ...]) -> Money | None:
        retail = row[COL_RETAIL_PRICE] if len(row) > COL_RETAIL_PRICE else None
        amount = parse_money_decimal(retail)
        if amount is None:
            return None
        # Currency is unconfirmed (no currency column; ADR-0005 "What
        # would make this authoritative" item 2) so the ISO 4217 "no
        # currency" sentinel stands in rather than a guessed USD/CAD.
        return Money(amount, UNCONFIRMED_CURRENCY)

    @staticmethod
    def _build_dimensions(row: tuple[object, ...]) -> Dimensions | None:
        raw = first_non_blank(
            *(row[c] if len(row) > c else None for c in DIMENSIONS_COLS)
        )
        parsed = parse_dimensions_inches(raw) if raw is not None else None
        if parsed is None:
            return None
        return Dimensions.from_inches(
            width_in=parsed.width_in,
            height_in=parsed.height_in,
            depth_in=parsed.depth_in,
        )
