"""The job-outcome state and the `VisualVariant` candidate record.

Three separate states govern a `VisualVariant`, per
`agentic_flow/15_variant_generation_technical_design.md` ("Review and
export — three separate states") and the project-wide rule in
`agentic_flow/00_agentic_workflow_overview.md`: job success, candidate
review, and commercial availability must never collapse into one field.
`job_outcome` lives here; `review.ReviewDecision` and
`commercial_status.CommercialAvailability` are the other two.
"""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass, field
from enum import StrEnum
from types import MappingProxyType
from typing import Any

from curalina_variants.domain.colour_spec import ColourSpec
from curalina_variants.domain.commercial_status import CommercialAvailability
from curalina_variants.domain.review import ReviewDecision


class JobOutcome(StrEnum):
    QUEUED = "queued"
    RUNNING = "running"
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    CANCELLED = "cancelled"


TERMINAL_JOB_OUTCOMES = frozenset(
    {JobOutcome.SUCCEEDED, JobOutcome.FAILED, JobOutcome.CANCELLED}
)

# queued -> running -> succeeded|failed|cancelled, plus a cooperative
# cancellation edge from either non-terminal state.
ALLOWED_JOB_TRANSITIONS: dict[JobOutcome, frozenset[JobOutcome]] = {
    JobOutcome.QUEUED: frozenset({JobOutcome.RUNNING, JobOutcome.CANCELLED}),
    JobOutcome.RUNNING: frozenset(
        {JobOutcome.SUCCEEDED, JobOutcome.FAILED, JobOutcome.CANCELLED}
    ),
    JobOutcome.SUCCEEDED: frozenset(),
    JobOutcome.FAILED: frozenset(),
    JobOutcome.CANCELLED: frozenset(),
}


def _empty_manifest() -> Mapping[str, Any]:
    return MappingProxyType({})


@dataclass(frozen=True, slots=True)
class VisualVariant:
    """A single recoloured candidate of a product image.

    `generation_manifest` records what an adapter did (or, for the fake
    adapters used throughout A2, that it did nothing real) — never treat its
    presence as evidence of accepted image quality.
    """

    variant_id: str
    parent_product_id: str
    source_asset_id: str
    mask_id: str
    target_colour: ColourSpec
    job_outcome: JobOutcome
    review_status: ReviewDecision = ReviewDecision.PENDING
    commercial_status: CommercialAvailability = CommercialAvailability.CONCEPTUAL
    output_asset_id: str | None = None
    revision: int = 1
    generation_manifest: Mapping[str, Any] = field(default_factory=_empty_manifest)

    def __post_init__(self) -> None:
        id_fields = ("variant_id", "parent_product_id", "source_asset_id", "mask_id")
        for field_name in id_fields:
            if not getattr(self, field_name).strip():
                raise ValueError(f"VisualVariant.{field_name} must not be blank")
        if self.revision < 1:
            raise ValueError("VisualVariant.revision must be >= 1")
        if (
            self.commercial_status is not CommercialAvailability.CONCEPTUAL
            and self.review_status is not ReviewDecision.APPROVED
        ):
            raise ValueError(
                "commercial_status may only leave 'conceptual' once "
                "review_status is 'approved' — approval and purchasability "
                "are independent states, never collapsed"
            )
        job_succeeded = self.job_outcome is JobOutcome.SUCCEEDED
        if self.output_asset_id is not None and not job_succeeded:
            raise ValueError(
                "output_asset_id may only be set once job_outcome is 'succeeded'"
            )
        if not isinstance(self.generation_manifest, MappingProxyType):
            frozen_manifest = MappingProxyType(dict(self.generation_manifest))
            object.__setattr__(self, "generation_manifest", frozen_manifest)
