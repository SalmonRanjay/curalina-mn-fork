"""`CatalogueImporter` port.

Future home of workflow step 2 ("Workbook/audit importer and immutable
catalogue-snapshot creation") from `agentic_flow/recommendation_workflow.md`'s
A2 sequence. That step depends on R01's reviewed canonical sample of the
Celadon workbook; R01 has not been run, so no real implementation of this
port exists yet. Only `adapters.fake_catalogue_importer.FakeCatalogueImporter`
implements it today.

The real implementation, once R01 clears, will read the reviewed workbook
sample, apply `architecture/guides/03_data_contracts.md`'s source-mapping
rules (Unicode whitespace normalization, unit conversion, duplicate-key
rejection) using pandas for ingest only, and hand back a
`domain.CatalogueSnapshot` built entirely from typed domain records — no
DataFrame is allowed to cross the port boundary.
"""

from __future__ import annotations

from typing import Protocol

from curalina_recommendation.domain.catalogue import CatalogueSnapshot


class CatalogueImporter(Protocol):
    """Imports a curated catalogue source into an immutable snapshot."""

    def import_catalogue(
        self, *, source_uri: str, supplier_id: str
    ) -> CatalogueSnapshot:
        """Import `source_uri` for `supplier_id` into a new `CatalogueSnapshot`.

        Real implementation: reads and validates the reviewed workbook
        sample (blocked on R01), builds typed `Product` records, and
        raises `domain.DuplicateProductKeyError`/`domain.InvalidSkuError`
        for rows that fail those invariants rather than dropping them
        silently — `CatalogueSnapshot.report` records what was seen,
        imported, and rejected.
        """
        ...
