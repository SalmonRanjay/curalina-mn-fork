"""Render-job state: three separate fields, never collapsed.

Per `agentic_flow/00_agentic_workflow_overview.md` ("Job success, candidate
review, and commercial availability are three separate states — never
collapse them") and `architecture/guides/03_data_contracts.md` /
`10_source_audit.md` ("A job success and an approved/purchasable output are
separate facts"), `RenderJobState` keeps these as three independent fields
rather than a single collapsed status:

- `job_status` — did the render job itself run to completion.
- `review_status` — did a human designer approve the resulting candidate.
- `commercial_availability` — is the depicted bundle/variant actually
  purchasable. This field is *never derived here*; it is carried through
  unchanged from the upstream bundle/variant snapshot the request
  referenced (mirrors the variant service's `commercial_status`:
  conceptual/custom_order/supplier_confirmed, plus `unknown` for missing
  commercial facts, per `03_data_contracts.md`).
"""

from __future__ import annotations

from dataclasses import dataclass, replace
from enum import StrEnum


class JobStatus(StrEnum):
    QUEUED = "queued"
    RUNNING = "running"
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    CANCELLED = "cancelled"


class CandidateReviewStatus(StrEnum):
    """`NOT_APPLICABLE` until a candidate exists (the job has not yet
    succeeded); otherwise mirrors the variant service's `review_status`."""

    NOT_APPLICABLE = "not_applicable"
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class CommercialAvailability(StrEnum):
    """Mirrors the variant service's `commercial_status` plus `UNKNOWN` for
    missing commercial facts (`03_data_contracts.md`: "Missing critical
    commercial facts produce `unknown`, not `available`")."""

    UNKNOWN = "unknown"
    CONCEPTUAL = "conceptual"
    CUSTOM_ORDER = "custom_order"
    SUPPLIER_CONFIRMED = "supplier_confirmed"


@dataclass(frozen=True)
class RenderJobState:
    render_job_id: str
    job_status: JobStatus
    review_status: CandidateReviewStatus
    commercial_availability: CommercialAvailability
    attempt_count: int
    candidate_id: str | None = None

    def __post_init__(self) -> None:
        if not self.render_job_id.strip():
            raise ValueError("render_job_id is required")
        if self.attempt_count < 0:
            raise ValueError("attempt_count must be >= 0")
        if self.candidate_id is not None and self.job_status is not JobStatus.SUCCEEDED:
            raise ValueError("candidate_id requires job_status == SUCCEEDED")
        no_candidate_needs_na = (
            self.candidate_id is None
            and self.review_status is not CandidateReviewStatus.NOT_APPLICABLE
        )
        if no_candidate_needs_na:
            raise ValueError(
                "review_status requires a candidate_id; use NOT_APPLICABLE "
                "before a candidate exists"
            )

    def with_review(
        self, decision: CandidateReviewStatus
    ) -> RenderJobState:
        """Return a new state reflecting a candidate review decision.

        Never touches `commercial_availability` — review approval and
        commercial availability remain distinct
        (`architecture/guides/01_system_architecture.md`).
        """

        if self.candidate_id is None:
            raise ValueError("cannot review a job with no candidate")
        if decision is CandidateReviewStatus.NOT_APPLICABLE:
            raise ValueError("a review decision cannot be NOT_APPLICABLE")
        return replace(self, review_status=decision)
