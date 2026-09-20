from __future__ import annotations

from curalina_recommendation.api.application_services import (
    build_application_services,
)
from curalina_recommendation.api.mappers import (
    bundle_response_from_domain,
    catalogue_import_response_from_domain,
    profile_from_dto,
    recommendation_response_from_domain,
)
from curalina_recommendation.api.schemas import DesignProfileIn


def test_profile_mapper_preserves_money_minor_units_and_categories() -> None:
    dto = DesignProfileIn(
        room_type="living_room",
        style="organic_modern",
        atmosphere="warm",
        categories=["sofa", "wall_art"],
        furniture_budget_minor_units=12345,
        currency="cad",
    )

    profile = profile_from_dto(dto, profile_id="profile-api")

    assert profile.profile_id == "profile-api"
    assert profile.budget.to_minor_units() == 12345
    assert profile.budget.currency == "CAD"
    assert profile.categories == ("sofa", "wall_art")


def test_application_services_map_domain_results_to_response_dtos() -> None:
    services = build_application_services()
    snapshot = services.catalogue.import_catalogue(
        source_uri="file://fixture", supplier_id="supplier_curated_001"
    )
    profile = profile_from_dto(
        DesignProfileIn(
            room_type="living_room",
            style="organic_modern",
            atmosphere="warm",
            categories=["sofa"],
            furniture_budget_minor_units=200000,
            currency="CAD",
        ),
        profile_id="profile-api",
    )

    import_response = catalogue_import_response_from_domain(snapshot)
    candidates = services.ranking.recommend(products=snapshot.products, profile=profile)
    recommendation_response = recommendation_response_from_domain(
        catalogue_snapshot_id=snapshot.snapshot_id,
        candidates=candidates,
    )
    bundle = services.bundles.compose(
        products=snapshot.products,
        profile=profile,
        catalogue_snapshot_id=snapshot.snapshot_id,
        rules_version="rules_test",
    )
    bundle_response = bundle_response_from_domain(bundle)

    assert import_response.report.products_imported == 4
    assert recommendation_response.candidates[0].product_id == "prod_sofa_0001"
    assert bundle_response.feasible is False
    assert bundle_response.total_minor_units == 110000
    assert {
        violation.code for violation in bundle_response.violations
    } >= {"needs_input:style_proportion:OQ-002"}
