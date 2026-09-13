import pytest

from curalina_variants.application.advance_commercial_status import (
    CommercialAvailabilityBlocked,
    advance_commercial_status,
)
from curalina_variants.application.review_candidate import (
    InvalidReviewTransition,
    apply_review,
)
from curalina_variants.domain.colour_spec import ColourSpec, RgbColour
from curalina_variants.domain.commercial_status import CommercialAvailability
from curalina_variants.domain.review import ReviewDecision
from curalina_variants.domain.variant_candidate import JobOutcome, VisualVariant

_COLOUR = ColourSpec(colour=RgbColour(10, 20, 30), colour_name="Charcoal")


def _pending_variant() -> VisualVariant:
    return VisualVariant(
        variant_id="variant_1",
        parent_product_id="product_1",
        source_asset_id="asset_1",
        mask_id="mask_1",
        target_colour=_COLOUR,
        job_outcome=JobOutcome.SUCCEEDED,
    )


def test_apply_review_approves_a_pending_candidate() -> None:
    reviewed = apply_review(_pending_variant(), ReviewDecision.APPROVED)
    assert reviewed.review_status is ReviewDecision.APPROVED
    assert reviewed.commercial_status is CommercialAvailability.CONCEPTUAL


def test_apply_review_rejects_a_pending_candidate() -> None:
    reviewed = apply_review(_pending_variant(), ReviewDecision.REJECTED)
    assert reviewed.review_status is ReviewDecision.REJECTED


def test_apply_review_cannot_move_back_to_pending() -> None:
    with pytest.raises(InvalidReviewTransition, match="pending"):
        apply_review(_pending_variant(), ReviewDecision.PENDING)


def test_apply_review_rejects_reviewing_an_already_reviewed_candidate() -> None:
    approved = apply_review(_pending_variant(), ReviewDecision.APPROVED)
    with pytest.raises(InvalidReviewTransition, match="already reviewed"):
        apply_review(approved, ReviewDecision.REJECTED)


def test_advance_commercial_status_blocked_without_approval() -> None:
    with pytest.raises(CommercialAvailabilityBlocked, match="is not approved"):
        advance_commercial_status(
            _pending_variant(), CommercialAvailability.CUSTOM_ORDER
        )


def test_advance_commercial_status_succeeds_after_approval() -> None:
    approved = apply_review(_pending_variant(), ReviewDecision.APPROVED)

    advanced = advance_commercial_status(approved, CommercialAvailability.CUSTOM_ORDER)

    assert advanced.commercial_status is CommercialAvailability.CUSTOM_ORDER
    assert advanced.review_status is ReviewDecision.APPROVED


def test_advance_commercial_status_cannot_move_back_to_conceptual() -> None:
    approved = apply_review(_pending_variant(), ReviewDecision.APPROVED)
    with pytest.raises(CommercialAvailabilityBlocked, match="conceptual"):
        advance_commercial_status(approved, CommercialAvailability.CONCEPTUAL)
