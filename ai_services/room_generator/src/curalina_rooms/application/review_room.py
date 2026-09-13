"""`ReviewRoom` — apply a designer's candidate review decision.

Version-checked the same way the A1 contract layer checks candidate
reviews (`curalina_rooms.api.service.RoomsContractService.
create_candidate_review`): a rejection after an approval creates a new
decision without rewriting history, and review approval never changes
`commercial_availability` (`architecture/guides/01_system_architecture.md`).
"""

from __future__ import annotations

from curalina_rooms.domain.render_job import (
    CandidateReviewStatus,
    JobStatus,
    RenderJobState,
)


class ReviewVersionConflictError(Exception):
    def __init__(
        self, render_job_id: str, expected_version: int, current_version: int
    ) -> None:
        self.render_job_id = render_job_id
        self.expected_version = expected_version
        self.current_version = current_version
        super().__init__(
            f"render job {render_job_id!r} review is at version "
            f"{current_version}, not the expected {expected_version}"
        )


def review_room(
    job_state: RenderJobState,
    *,
    decision: CandidateReviewStatus,
    expected_version: int,
    current_version: int,
) -> RenderJobState:
    job_succeeded = job_state.job_status is JobStatus.SUCCEEDED
    if not job_succeeded or job_state.candidate_id is None:
        raise ValueError(
            "cannot review a candidate for a job that has not succeeded"
        )
    if expected_version != current_version:
        raise ReviewVersionConflictError(
            job_state.render_job_id, expected_version, current_version
        )
    return job_state.with_review(decision)
