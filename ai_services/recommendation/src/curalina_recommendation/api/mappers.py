"""DTO/domain translation for the recommendation HTTP boundary."""

from __future__ import annotations

from curalina_recommendation.api.schemas import (
    BundleLineItem,
    BundleResponse,
    BundleViolation,
    CatalogueImportReport,
    CatalogueImportResponse,
    DesignProfileIn,
    RankedCandidate,
    RecommendationResponse,
    SubstitutionResponse,
)
from curalina_recommendation.domain.bundle import Bundle
from curalina_recommendation.domain.catalogue import CatalogueSnapshot
from curalina_recommendation.domain.money import Money
from curalina_recommendation.domain.profile import Profile
from curalina_recommendation.domain.ranking import RankedCandidate as DomainCandidate


def profile_from_dto(dto: DesignProfileIn, *, profile_id: str) -> Profile:
    return Profile(
        profile_id=profile_id,
        room_type=dto.room_type,
        style=dto.style,
        atmosphere=dto.atmosphere,
        categories=tuple(dto.categories),
        budget=Money.from_minor_units(
            dto.furniture_budget_minor_units, dto.currency
        ),
    )


def catalogue_import_response_from_domain(
    snapshot: CatalogueSnapshot,
) -> CatalogueImportResponse:
    return CatalogueImportResponse(
        snapshot_id=snapshot.snapshot_id,
        report=CatalogueImportReport(
            products_seen=snapshot.report.products_seen,
            products_imported=snapshot.report.products_imported,
            products_rejected=snapshot.report.products_rejected,
            rejected_reasons=list(snapshot.report.rejected_reasons),
        ),
    )


def recommendation_response_from_domain(
    *, catalogue_snapshot_id: str, candidates: tuple[DomainCandidate, ...]
) -> RecommendationResponse:
    return RecommendationResponse(
        catalogue_snapshot_id=catalogue_snapshot_id,
        candidates=[
            RankedCandidate(
                product_id=candidate.product_id,
                category=candidate.category,
                score=candidate.score,
                reasons=[reason.value for reason in candidate.reasons],
            )
            for candidate in candidates
        ],
    )


def bundle_response_from_domain(bundle: Bundle) -> BundleResponse:
    total = bundle.total if bundle.line_items else None
    return BundleResponse(
        bundle_id=bundle.bundle_id,
        revision=bundle.revision,
        feasible=bundle.feasible,
        line_items=[
            BundleLineItem(
                product_id=item.product_id,
                category=item.category,
                quantity=item.quantity,
                unit_price_minor_units=item.unit_price.to_minor_units(),
                currency=item.unit_price.currency,
            )
            for item in bundle.line_items
        ],
        total_minor_units=total.to_minor_units() if total is not None else 0,
        currency=total.currency if total is not None else bundle.currency,
        violations=[
            BundleViolation(code=violation, message=violation)
            for violation in bundle.violations
        ],
        warnings=list(bundle.warnings),
    )


def substitution_response_from_domain(
    *, original_bundle_id: str, bundle: Bundle
) -> SubstitutionResponse:
    return SubstitutionResponse(
        original_bundle_id=original_bundle_id,
        new_bundle_id=f"{bundle.bundle_id}_rev{bundle.revision:04d}",
        revision=bundle.revision,
        feasible=bundle.feasible,
        line_items=[
            BundleLineItem(
                product_id=item.product_id,
                category=item.category,
                quantity=item.quantity,
                unit_price_minor_units=item.unit_price.to_minor_units(),
                currency=item.unit_price.currency,
            )
            for item in bundle.line_items
        ],
        violations=[
            BundleViolation(code=violation, message=violation)
            for violation in bundle.violations
        ],
    )
