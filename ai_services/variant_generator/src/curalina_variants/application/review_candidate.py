"""Use case: apply a reviewer's decision to a pending candidate.

Enforces the review-state transition rules from
`agentic_flow/15_variant_generation_technical_design.md`: `pending ->
approved | rejected` only, one decision per candidate. Approving a
candidate flips `review_status` alone — `commercial_status` is untouched
(and `VisualVariant.__post_init__` would reject any attempt to smuggle a
commercial-status change in alongside it), because approval never implies
purchasability.
"""

from __future__ import annotations

from dataclasses import replace

from curalina_variants.domain.review import ReviewDecision
from curalina_variants.domain.variant_candidate import VisualVariant


class InvalidReviewTransition(Exception):
    """Raised for any review transition other than a single
    `pending -> approved` or `pending -> rejected` move."""


def apply_review(variant: VisualVariant, decision: ReviewDecision) -> VisualVariant:
    if decision is ReviewDecision.PENDING:
        raise InvalidReviewTransition("cannot review a candidate back to 'pending'")
    if variant.review_status is not ReviewDecision.PENDING:
        raise InvalidReviewTransition(
            f"candidate {variant.variant_id!r} was already reviewed "
            f"(review_status={variant.review_status.value!r})"
        )
    return replace(variant, review_status=decision)
