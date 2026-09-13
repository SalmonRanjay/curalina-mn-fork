import pytest

from curalina_rooms.domain.render_job import (
    CandidateReviewStatus,
    CommercialAvailability,
    JobStatus,
    RenderJobState,
)


def test_three_states_are_independent_fields() -> None:
    """Job success, candidate review, and commercial availability must be
    three separate fields, never collapsed
    (`agentic_flow/00_agentic_workflow_overview.md`)."""

    state = RenderJobState(
        render_job_id="job_0001",
        job_status=JobStatus.SUCCEEDED,
        review_status=CandidateReviewStatus.PENDING,
        commercial_availability=CommercialAvailability.CUSTOM_ORDER,
        attempt_count=1,
        candidate_id="asset_fake_0001",
    )

    assert state.job_status is JobStatus.SUCCEEDED
    assert state.review_status is CandidateReviewStatus.PENDING
    assert state.commercial_availability is CommercialAvailability.CUSTOM_ORDER


def test_candidate_id_requires_succeeded_job() -> None:
    with pytest.raises(ValueError, match="candidate_id"):
        RenderJobState(
            render_job_id="job_0001",
            job_status=JobStatus.RUNNING,
            review_status=CandidateReviewStatus.NOT_APPLICABLE,
            commercial_availability=CommercialAvailability.UNKNOWN,
            attempt_count=1,
            candidate_id="asset_fake_0001",
        )


def test_review_status_requires_a_candidate() -> None:
    with pytest.raises(ValueError, match="review_status"):
        RenderJobState(
            render_job_id="job_0001",
            job_status=JobStatus.QUEUED,
            review_status=CandidateReviewStatus.PENDING,
            commercial_availability=CommercialAvailability.UNKNOWN,
            attempt_count=0,
            candidate_id=None,
        )


def test_review_never_changes_commercial_availability() -> None:
    """Review approval and commercial availability remain distinct
    (`architecture/guides/01_system_architecture.md`)."""

    state = RenderJobState(
        render_job_id="job_0001",
        job_status=JobStatus.SUCCEEDED,
        review_status=CandidateReviewStatus.PENDING,
        commercial_availability=CommercialAvailability.CONCEPTUAL,
        attempt_count=1,
        candidate_id="asset_fake_0001",
    )

    approved = state.with_review(CandidateReviewStatus.APPROVED)

    assert approved.review_status is CandidateReviewStatus.APPROVED
    assert approved.commercial_availability is CommercialAvailability.CONCEPTUAL
    assert approved.job_status is JobStatus.SUCCEEDED


def test_with_review_requires_a_candidate() -> None:
    state = RenderJobState(
        render_job_id="job_0001",
        job_status=JobStatus.FAILED,
        review_status=CandidateReviewStatus.NOT_APPLICABLE,
        commercial_availability=CommercialAvailability.UNKNOWN,
        attempt_count=1,
        candidate_id=None,
    )

    with pytest.raises(ValueError):
        state.with_review(CandidateReviewStatus.APPROVED)
