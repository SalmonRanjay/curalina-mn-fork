"""A3 composition root for recommendation API handlers."""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal

from curalina_recommendation.adapters.fake_catalogue_importer import (
    FakeCatalogueImporter,
)
from curalina_recommendation.adapters.fake_feature_encoder import FakeFeatureEncoder
from curalina_recommendation.adapters.logic_only_bundle_composer import (
    SYNTHETIC_FIXTURE_LABEL,
    LogicOnlyBundleComposer,
)
from curalina_recommendation.api.repository import RecommendationRepository
from curalina_recommendation.application.bundle_service import BundleService
from curalina_recommendation.application.catalogue_service import CatalogueService
from curalina_recommendation.application.ranking_service import RankingService
from curalina_recommendation.domain.bundle import Bundle, BundleLineItem
from curalina_recommendation.domain.dimensions import Dimensions
from curalina_recommendation.domain.eligibility import Availability
from curalina_recommendation.domain.money import Money
from curalina_recommendation.domain.product import Product, ProductKey
from curalina_recommendation.settings import Settings

_SUPPLIER_ID = "supplier_curated_001"
_SNAPSHOT_ID = "snap_a3fixture0001"
_DIMENSIONS = Dimensions.from_inches(
    width_in=Decimal("36"), height_in=Decimal("30"), depth_in=Decimal("24")
)


def _fixture_product(
    product_id: str, *, category: str, price_minor_units: int
) -> Product:
    return Product(
        product_id=product_id,
        key=ProductKey.build(supplier_id=_SUPPLIER_ID, raw_sku=product_id),
        category=category,
        name=product_id.replace("_", " ").title(),
        availability=Availability.AVAILABLE,
        price=Money.from_minor_units(price_minor_units, "CAD"),
        dimensions=_DIMENSIONS,
        source_snapshot_id=_SNAPSHOT_ID,
        overview=f"Synthetic A3 fixture product for {category}.",
        fixture_label=SYNTHETIC_FIXTURE_LABEL,
    )


def build_fixture_products() -> tuple[Product, ...]:
    return (
        _fixture_product("prod_sofa_0001", category="sofa", price_minor_units=120000),
        _fixture_product("prod_sofa_0002", category="sofa", price_minor_units=110000),
        _fixture_product(
            "prod_wall_art_0001", category="wall_art", price_minor_units=40000
        ),
        _fixture_product(
            "prod_coffee_table_0001",
            category="coffee_table",
            price_minor_units=35000,
        ),
    )


@dataclass(frozen=True, slots=True)
class RecommendationApplicationServices:
    catalogue: CatalogueService
    ranking: RankingService
    bundles: BundleService
    repository: RecommendationRepository
    products: tuple[Product, ...]


def _seed_legacy_substitution_bundle(
    repository: RecommendationRepository, products: tuple[Product, ...]
) -> None:
    sofa = next(
        product for product in products if product.product_id == "prod_sofa_0001"
    )
    assert sofa.price is not None
    repository.save_bundle(
        Bundle(
            bundle_id="rev_a1fixture0001",
            revision=1,
            profile_snapshot_id="profile_http",
            catalogue_snapshot_id=_SNAPSHOT_ID,
            rules_version="rules_2024_01",
            currency=sofa.price.currency,
            line_items=(
                BundleLineItem(
                    product_id=sofa.product_id,
                    category=sofa.category,
                    quantity=1,
                    unit_price=sofa.price,
                ),
            ),
            feasible=True,
        )
    )


def build_application_services(
    settings: Settings | None = None,
) -> RecommendationApplicationServices:
    settings = settings or Settings()
    products = build_fixture_products()
    repository = RecommendationRepository.from_database_url(
        settings.curalina_database_url
    )
    repository.initialize()
    repository.seed_fixture_snapshot(
        snapshot_id=_SNAPSHOT_ID, supplier_id=_SUPPLIER_ID, products=products
    )
    # Preserve the A1 contract fixture id as a durable local snapshot alias.
    repository.seed_fixture_snapshot(
        snapshot_id="snap_a1fixture0001", supplier_id=_SUPPLIER_ID, products=products
    )
    _seed_legacy_substitution_bundle(repository, products)
    return RecommendationApplicationServices(
        catalogue=CatalogueService(
            importer=FakeCatalogueImporter(
                fixture_products=products, snapshot_id=_SNAPSHOT_ID
            )
        ),
        ranking=RankingService(encoder=FakeFeatureEncoder()),
        bundles=BundleService(composer=LogicOnlyBundleComposer()),
        repository=repository,
        products=products,
    )
