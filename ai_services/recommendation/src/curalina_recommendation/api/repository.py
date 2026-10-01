"""Postgres persistence for recommendation A3 API state.

Schema is owned by the checked-in Alembic migrations under
`migrations/versions/` (see `curalina_recommendation.db.migrator`), not by
this module — `initialize()` runs those migrations rather than issuing ad
hoc `CREATE TABLE IF NOT EXISTS` statements.
"""

from __future__ import annotations

import json
from collections.abc import Iterable, Iterator
from contextlib import contextmanager
from dataclasses import dataclass
from typing import Any
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

import psycopg
from psycopg.rows import dict_row

from curalina_recommendation.db.migrator import run_migrations
from curalina_recommendation.domain.bundle import Bundle, BundleLineItem
from curalina_recommendation.domain.catalogue import (
    CatalogueImportReport,
    CatalogueSnapshot,
)
from curalina_recommendation.domain.dimensions import Dimensions, Millimetres
from curalina_recommendation.domain.eligibility import Availability
from curalina_recommendation.domain.money import Money
from curalina_recommendation.domain.product import Product, ProductKey


class BundleNotFoundError(LookupError):
    """Raised when substitution is requested for an unknown bundle id."""


class ReplacementCandidateNotFoundError(LookupError):
    """Raised when no synthetic candidate can replace a requested line."""


def _dsn_with_schema(database_url: str, schema: str) -> str:
    if not database_url.startswith(("postgresql://", "postgresql+psycopg://")):
        raise ValueError(
            "recommendation A3 only supports postgresql:// database URLs, "
            f"got {database_url!r}"
        )
    bare = "postgresql://" + database_url.split("://", 1)[1]
    if schema == "public":
        return bare
    parsed = urlparse(bare)
    query = dict(parse_qsl(parsed.query))
    query["options"] = f"-csearch_path={schema}"
    return urlunparse(parsed._replace(query=urlencode(query)))


def _product_to_payload(product: Product) -> dict[str, Any]:
    dimensions = None
    if product.dimensions is not None:
        dimensions = {
            "width_mm": product.dimensions.width_mm.value,
            "height_mm": product.dimensions.height_mm.value,
            "depth_mm": (
                product.dimensions.depth_mm.value
                if product.dimensions.depth_mm is not None
                else None
            ),
        }
    return {
        "product_id": product.product_id,
        "supplier_id": product.key.supplier_id,
        "raw_sku": product.key.raw_sku,
        "category": product.category,
        "name": product.name,
        "availability": product.availability.value,
        "price_minor_units": (
            product.price.to_minor_units() if product.price is not None else None
        ),
        "currency": product.price.currency if product.price is not None else None,
        "dimensions": dimensions,
        "source_snapshot_id": product.source_snapshot_id,
        "overview": product.overview,
        "fixture_label": product.fixture_label,
    }


def _product_from_payload(payload: dict[str, Any]) -> Product:
    dimensions_payload = payload["dimensions"]
    dimensions = None
    if dimensions_payload is not None:
        dimensions = Dimensions(
            width_mm=Millimetres(dimensions_payload["width_mm"]),
            height_mm=Millimetres(dimensions_payload["height_mm"]),
            depth_mm=(
                Millimetres(dimensions_payload["depth_mm"])
                if dimensions_payload["depth_mm"] is not None
                else None
            ),
        )
    price = None
    if payload["price_minor_units"] is not None:
        price = Money.from_minor_units(
            payload["price_minor_units"], payload["currency"]
        )
    return Product(
        product_id=payload["product_id"],
        key=ProductKey.build(
            supplier_id=payload["supplier_id"], raw_sku=payload["raw_sku"]
        ),
        category=payload["category"],
        name=payload["name"],
        availability=Availability(payload["availability"]),
        price=price,
        dimensions=dimensions,
        source_snapshot_id=payload["source_snapshot_id"],
        overview=payload["overview"],
        fixture_label=payload.get("fixture_label"),
    )


def _bundle_to_payload(bundle: Bundle) -> dict[str, Any]:
    return {
        "bundle_id": bundle.bundle_id,
        "revision": bundle.revision,
        "profile_snapshot_id": bundle.profile_snapshot_id,
        "catalogue_snapshot_id": bundle.catalogue_snapshot_id,
        "rules_version": bundle.rules_version,
        "currency": bundle.currency,
        "feasible": bundle.feasible,
        "violations": list(bundle.violations),
        "warnings": list(bundle.warnings),
        "line_items": [
            {
                "product_id": item.product_id,
                "category": item.category,
                "quantity": item.quantity,
                "unit_price_minor_units": item.unit_price.to_minor_units(),
                "currency": item.unit_price.currency,
            }
            for item in bundle.line_items
        ],
    }


def _bundle_from_payload(payload: dict[str, Any]) -> Bundle:
    return Bundle(
        bundle_id=payload["bundle_id"],
        revision=payload["revision"],
        profile_snapshot_id=payload["profile_snapshot_id"],
        catalogue_snapshot_id=payload["catalogue_snapshot_id"],
        rules_version=payload["rules_version"],
        currency=payload["currency"],
        line_items=tuple(
            BundleLineItem(
                product_id=item["product_id"],
                category=item["category"],
                quantity=item["quantity"],
                unit_price=Money.from_minor_units(
                    item["unit_price_minor_units"], item["currency"]
                ),
            )
            for item in payload["line_items"]
        ),
        feasible=payload["feasible"],
        violations=tuple(payload["violations"]),
        warnings=tuple(payload["warnings"]),
    )


@dataclass(frozen=True, slots=True)
class RecommendationRepository:
    database_url: str
    schema: str = "public"

    @classmethod
    def from_database_url(
        cls, database_url: str, *, schema: str = "public"
    ) -> RecommendationRepository:
        _dsn_with_schema(database_url, schema)  # eager validation
        return cls(database_url=database_url, schema=schema)

    def initialize(self) -> None:
        run_migrations(self.database_url, schema=self.schema)

    def seed_fixture_snapshot(
        self, *, snapshot_id: str, supplier_id: str, products: Iterable[Product]
    ) -> None:
        products_tuple = tuple(products)
        report = CatalogueImportReport(
            products_seen=len(products_tuple),
            products_imported=len(products_tuple),
            products_rejected=0,
        )
        self.save_snapshot(
            CatalogueSnapshot(
                snapshot_id=snapshot_id,
                supplier_id=supplier_id,
                products=products_tuple,
                report=report,
            )
        )

    def save_snapshot(self, snapshot: CatalogueSnapshot) -> None:
        products_json = json.dumps(
            [_product_to_payload(product) for product in snapshot.products],
            sort_keys=True,
        )
        report_json = json.dumps(
            {
                "products_seen": snapshot.report.products_seen,
                "products_imported": snapshot.report.products_imported,
                "products_rejected": snapshot.report.products_rejected,
                "rejected_reasons": list(snapshot.report.rejected_reasons),
            },
            sort_keys=True,
        )
        with self._connect() as connection:
            connection.execute(
                """
                INSERT INTO catalogue_snapshots
                    (snapshot_id, supplier_id, products_json, report_json)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (snapshot_id) DO UPDATE SET
                    supplier_id = EXCLUDED.supplier_id,
                    products_json = EXCLUDED.products_json,
                    report_json = EXCLUDED.report_json
                """,
                (
                    snapshot.snapshot_id,
                    snapshot.supplier_id,
                    products_json,
                    report_json,
                ),
            )

    def get_products_for_snapshot(self, snapshot_id: str) -> tuple[Product, ...]:
        with self._connect() as connection:
            row = connection.execute(
                "SELECT products_json FROM catalogue_snapshots WHERE snapshot_id = %s",
                (snapshot_id,),
            ).fetchone()
        if row is None:
            return ()
        payloads = json.loads(str(row["products_json"]))
        return tuple(_product_from_payload(payload) for payload in payloads)

    def save_bundle(self, bundle: Bundle) -> None:
        payload_json = json.dumps(_bundle_to_payload(bundle), sort_keys=True)
        with self._connect() as connection:
            connection.execute(
                """
                INSERT INTO rule_versions (rules_version)
                VALUES (%s)
                ON CONFLICT (rules_version) DO NOTHING
                """,
                (bundle.rules_version,),
            )
            connection.execute(
                """
                INSERT INTO bundles (bundle_id, revision, payload_json)
                VALUES (%s, %s, %s)
                ON CONFLICT (bundle_id) DO UPDATE SET
                    revision = EXCLUDED.revision,
                    payload_json = EXCLUDED.payload_json
                """,
                (bundle.bundle_id, bundle.revision, payload_json),
            )

    def get_bundle(self, bundle_id: str) -> Bundle:
        with self._connect() as connection:
            row = connection.execute(
                "SELECT payload_json FROM bundles WHERE bundle_id = %s",
                (bundle_id,),
            ).fetchone()
        if row is None:
            raise BundleNotFoundError(bundle_id)
        return _bundle_from_payload(json.loads(str(row["payload_json"])))

    def list_rule_versions(self) -> tuple[str, ...]:
        with self._connect() as connection:
            rows = connection.execute(
                "SELECT rules_version FROM rule_versions ORDER BY rules_version"
            ).fetchall()
        return tuple(str(row["rules_version"]) for row in rows)

    @contextmanager
    def _connect(self) -> Iterator[psycopg.Connection[Any]]:
        connection = psycopg.connect(
            _dsn_with_schema(self.database_url, self.schema), row_factory=dict_row
        )
        try:
            with connection:
                yield connection
        finally:
            connection.close()
