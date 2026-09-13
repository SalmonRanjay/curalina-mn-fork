"""`CatalogueSnapshot` — an immutable, deduplicated set of products.

Per `architecture/guides/03_data_contracts.md`: "Preserve the workbook as
a source snapshot" and "reject duplicate compound keys unless explicit
variant relationship." Building a `CatalogueSnapshot` is the one place
that invariant is enforced, so both the eventual real workbook importer
(workflow step 2, blocked on R01) and today's `FakeCatalogueImporter` share
the same guarantee: a snapshot can never silently contain two products
with the same `ProductKey`.
"""

from __future__ import annotations

from dataclasses import dataclass

from curalina_recommendation.domain.errors import DuplicateProductKeyError
from curalina_recommendation.domain.product import Product, ProductKey


@dataclass(frozen=True, slots=True)
class CatalogueImportReport:
    """Counts and reasons for one import run, independent of how many of
    those rejected records ever reach a `CatalogueSnapshot`.
    """

    products_seen: int
    products_imported: int
    products_rejected: int
    rejected_reasons: tuple[str, ...] = ()

    def __post_init__(self) -> None:
        counts = (self.products_seen, self.products_imported, self.products_rejected)
        if any(count < 0 for count in counts):
            raise ValueError("import report counts must be >= 0")
        if self.products_imported + self.products_rejected > self.products_seen:
            raise ValueError(
                "imported + rejected must not exceed seen "
                f"({self.products_imported} + {self.products_rejected} > "
                f"{self.products_seen})"
            )


@dataclass(frozen=True, slots=True)
class CatalogueSnapshot:
    """An immutable, deduplicated catalogue snapshot."""

    snapshot_id: str
    supplier_id: str
    products: tuple[Product, ...]
    report: CatalogueImportReport

    def __post_init__(self) -> None:
        if not self.snapshot_id.strip():
            raise ValueError("snapshot_id must not be blank")
        seen: set[ProductKey] = set()
        for product in self.products:
            if product.key in seen:
                raise DuplicateProductKeyError(
                    product.key.supplier_id, product.key.normalized_sku
                )
            seen.add(product.key)
