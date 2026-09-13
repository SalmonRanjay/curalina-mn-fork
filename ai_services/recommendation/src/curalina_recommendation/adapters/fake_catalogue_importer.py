"""`FakeCatalogueImporter` — FAKE ADAPTER, not a real workbook importer.

This adapter exists only so the application layer and A3's future API
have something to call before R01's reviewed workbook sample exists (see
`ports/catalogue_importer.py`). It does not read any workbook, does not
use pandas, and does not perform the source-mapping rules from
`architecture/guides/03_data_contracts.md` beyond what the domain layer
already enforces on construction (`CatalogueSnapshot` rejects duplicate
keys; `ProductKey.build` rejects whitespace-only SKUs).

It is deterministic and fast: given the same `source_uri`/`supplier_id`
and fixture products, it always returns the same snapshot id and report.
Nobody should read a call to this adapter as evidence that catalogue
import works against real data.
"""

from __future__ import annotations

from dataclasses import dataclass

from curalina_recommendation.domain.catalogue import (
    CatalogueImportReport,
    CatalogueSnapshot,
)
from curalina_recommendation.domain.product import Product

# Not inherited from: `ports.catalogue_importer.CatalogueImporter` is a
# structural `typing.Protocol` — this class satisfies it by shape, and
# deliberately avoids subclassing a Protocol under a frozen dataclass
# (which fights `@dataclass`'s generated `__init__`).


@dataclass(frozen=True, slots=True)
class FakeCatalogueImporter:
    """Returns a canned, deterministic snapshot built from `fixture_products`.

    `fixture_products` must already be valid `Product` domain records
    (e.g. built by a test or by `adapters.fixtures`); this adapter performs
    no parsing or validation of raw rows — that is exactly the real-logic
    work blocked on R01.
    """

    fixture_products: tuple[Product, ...]
    snapshot_id: str = "snap_fake_0001"

    def import_catalogue(
        self, *, source_uri: str, supplier_id: str
    ) -> CatalogueSnapshot:
        del source_uri  # fake adapter: input is accepted but not read
        matching = tuple(
            product
            for product in self.fixture_products
            if product.key.supplier_id == supplier_id
        )
        report = CatalogueImportReport(
            products_seen=len(self.fixture_products),
            products_imported=len(matching),
            products_rejected=len(self.fixture_products) - len(matching),
            rejected_reasons=(
                ()
                if len(matching) == len(self.fixture_products)
                else ("supplier_id_mismatch",)
            ),
        )
        return CatalogueSnapshot(
            snapshot_id=self.snapshot_id,
            supplier_id=supplier_id,
            products=matching,
            report=report,
        )
