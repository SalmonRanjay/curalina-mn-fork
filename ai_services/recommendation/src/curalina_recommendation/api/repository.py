"""SQLite persistence for recommendation A3 API state."""

from __future__ import annotations

import json
import sqlite3
from collections.abc import Iterable, Iterator
from contextlib import contextmanager
from dataclasses import dataclass
from pathlib import Path
from typing import Any

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


def sqlite_path_from_url(database_url: str) -> Path:
    prefix = "sqlite:///"
    if not database_url.startswith(prefix):
        raise ValueError(
            "recommendation A3 only supports sqlite:/// database URLs, got "
            f"{database_url!r}"
        )
    return Path(database_url.removeprefix(prefix))


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
    db_path: Path

    @classmethod
    def from_database_url(cls, database_url: str) -> RecommendationRepository:
        return cls(db_path=sqlite_path_from_url(database_url))

    def initialize(self) -> None:
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        with self._connect() as connection:
            connection.executescript(
                """
                CREATE TABLE IF NOT EXISTS catalogue_snapshots (
                    snapshot_id TEXT PRIMARY KEY,
                    supplier_id TEXT NOT NULL,
                    products_json TEXT NOT NULL,
                    report_json TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS rule_versions (
                    rules_version TEXT PRIMARY KEY
                );
                CREATE TABLE IF NOT EXISTS bundles (
                    bundle_id TEXT PRIMARY KEY,
                    revision INTEGER NOT NULL,
                    payload_json TEXT NOT NULL
                );
                """
            )

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
                INSERT OR REPLACE INTO catalogue_snapshots
                    (snapshot_id, supplier_id, products_json, report_json)
                VALUES (?, ?, ?, ?)
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
                "SELECT products_json FROM catalogue_snapshots WHERE snapshot_id = ?",
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
                INSERT OR REPLACE INTO rule_versions (rules_version)
                VALUES (?)
                """,
                (bundle.rules_version,),
            )
            connection.execute(
                """
                INSERT OR REPLACE INTO bundles
                    (bundle_id, revision, payload_json)
                VALUES (?, ?, ?)
                """,
                (bundle.bundle_id, bundle.revision, payload_json),
            )

    def get_bundle(self, bundle_id: str) -> Bundle:
        with self._connect() as connection:
            row = connection.execute(
                "SELECT payload_json FROM bundles WHERE bundle_id = ?",
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
    def _connect(self) -> Iterator[sqlite3.Connection]:
        connection = sqlite3.connect(self.db_path)
        connection.row_factory = sqlite3.Row
        try:
            with connection:
                yield connection
        finally:
            connection.close()
