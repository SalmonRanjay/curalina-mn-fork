"""`CatalogueService` — application-layer orchestration for catalogue import.

Calls through the `CatalogueImporter` port. Currently only
`adapters.FakeCatalogueImporter` is injected (constructor injection, per
`architecture/guides/08_engineering_and_tests.md`); the real workbook
importer (workflow step 2) is a drop-in replacement of the same port once
R01 clears — this orchestration does not change.
"""

from __future__ import annotations

from dataclasses import dataclass

from curalina_recommendation.domain.catalogue import CatalogueSnapshot
from curalina_recommendation.ports.catalogue_importer import CatalogueImporter


@dataclass(frozen=True, slots=True)
class CatalogueService:
    importer: CatalogueImporter

    def import_catalogue(
        self, *, source_uri: str, supplier_id: str
    ) -> CatalogueSnapshot:
        return self.importer.import_catalogue(
            source_uri=source_uri, supplier_id=supplier_id
        )
