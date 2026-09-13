import pytest

from curalina_rooms.application.review_room import (
    ReviewVersionConflictError,
    review_room,
)
from curalina_rooms.domain.render_job import (
    CandidateReviewStatus,
    CommercialAvailability,
    JobStatus,
    RenderJobState,
)


def _succeeded_state() -> RenderJobState:
    return RenderJobState(
        render_job_id="job_0001",
        job_status=JobStatus.SUCCEEDED,
        review_status=CandidateReviewStatus.PENDING,
        commercial_availability=CommercialAvailability.CONCEPTUAL,
        attempt_count=1,
        candidate_id="asset_fake_0001",
    )


def test_review_room_applies_decision_when_version_matches() -> None:
    updated = review_room(
        _succeeded_state(),
        decision=CandidateReviewStatus.APPROVED,
        expected_version=1,
        current_version=1,
    )

    assert updated.review_status is CandidateReviewStatus.APPROVED


def test_review_room_rejects_stale_version() -> None:
    with pytest.raises(ReviewVersionConflictError):
        review_room(
            _succeeded_state(),
            decision=CandidateReviewStatus.REJECTED,
            expected_version=1,
            current_version=2,
        )


def test_review_room_rejects_a_job_with_no_candidate() -> None:
    state = RenderJobState(
        render_job_id="job_0001",
        job_status=JobStatus.RUNNING,
        review_status=CandidateReviewStatus.NOT_APPLICABLE,
        commercial_availability=CommercialAvailability.UNKNOWN,
        attempt_count=1,
        candidate_id=None,
    )

    with pytest.raises(ValueError):
        review_room(
            state,
            decision=CandidateReviewStatus.APPROVED,
            expected_version=0,
            current_version=0,
        )
