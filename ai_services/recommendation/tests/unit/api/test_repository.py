from __future__ import annotations

from pathlib import Path

from curalina_recommendation.adapters.fake_bundle_composer import FakeBundleComposer
from curalina_recommendation.api.application_services import build_fixture_products
from curalina_recommendation.api.repository import RecommendationRepository
from curalina_recommendation.application.bundle_service import BundleService
from curalina_recommendation.domain.money import Money
from curalina_recommendation.domain.profile import Profile


def test_repository_round_trips_snapshot_bundle_and_rule_version(
    tmp_path: Path,
) -> None:
    repository = RecommendationRepository(tmp_path / "recommendation.sqlite3")
    repository.initialize()
    products = build_fixture_products()
    repository.seed_fixture_snapshot(
        snapshot_id="snap_test", supplier_id="supplier_curated_001", products=products
    )

    restored_products = repository.get_products_for_snapshot("snap_test")
    assert {product.product_id for product in restored_products} == {
        product.product_id for product in products
    }
    assert {product.fixture_label for product in restored_products} == {
        "labelled_synthetic_adr0013_logic_only"
    }

    bundle = BundleService(FakeBundleComposer()).compose(
        products=restored_products,
        profile=Profile(
            profile_id="profile-test",
            room_type="living_room",
            style="organic_modern",
            atmosphere="warm",
            categories=("sofa",),
            budget=Money.from_minor_units(200000, "CAD"),
        ),
        catalogue_snapshot_id="snap_test",
        rules_version="rules_test",
    )
    repository.save_bundle(bundle)

    restored_bundle = repository.get_bundle(bundle.bundle_id)
    assert restored_bundle == bundle
    assert repository.list_rule_versions() == ("rules_test",)
