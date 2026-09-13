"""Use case: move a candidate's commercial-availability state forward.

Requires `review_status == approved` first. This is what keeps job success,
candidate review, and commercial availability three independent fields —
generation succeeding does not make something reviewable-approved, and
review approval does not make something purchasable; a separate, explicit
step (this one) is required, and per
`agentic_flow/15_variant_generation_technical_design.md` a `custom_order`
promotion additionally needs a confirmed quote — enforcing that quote check
is out of scope for this fake-adapter phase and belongs to whichever service
owns quoting.
"""

from __future__ import annotations

from dataclasses import replace

from curalina_variants.domain.commercial_status import CommercialAvailability
from curalina_variants.domain.review import ReviewDecision
from curalina_variants.domain.variant_candidate import VisualVariant


class CommercialAvailabilityBlocked(Exception):
    """Raised when a commercial-status advance is attempted without a prior
    review approval, or attempts to move status backwards to `conceptual`."""


def advance_commercial_status(
    variant: VisualVariant, status: CommercialAvailability
) -> VisualVariant:
    if status is CommercialAvailability.CONCEPTUAL:
        raise CommercialAvailabilityBlocked(
            "cannot move commercial_status back to 'conceptual'"
        )
    if variant.review_status is not ReviewDecision.APPROVED:
        raise CommercialAvailabilityBlocked(
            f"candidate {variant.variant_id!r} is not approved "
            f"(review_status={variant.review_status.value!r}); "
            f"cannot mark commercial_status={status.value!r}"
        )
    return replace(variant, commercial_status=status)
