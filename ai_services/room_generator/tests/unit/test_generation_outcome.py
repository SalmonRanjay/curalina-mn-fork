import pytest

from curalina_rooms.domain.generation_outcome import GenerationOutcome


def test_attempt_count_must_be_positive() -> None:
    with pytest.raises(ValueError, match="attempt_count"):
        GenerationOutcome(
            render_job_id="job_0001",
            attempt_count=0,
            succeeded=True,
            candidate_asset_id="asset_fake_0001",
            failure_reason=None,
        )


def test_succeeded_outcome_requires_candidate_asset_id() -> None:
    with pytest.raises(ValueError, match="succeeded outcome"):
        GenerationOutcome(
            render_job_id="job_0001",
            attempt_count=1,
            succeeded=True,
            candidate_asset_id=None,
            failure_reason=None,
        )


def test_failed_outcome_must_not_carry_candidate_asset_id() -> None:
    with pytest.raises(ValueError, match="failed outcome must not"):
        GenerationOutcome(
            render_job_id="job_0001",
            attempt_count=1,
            succeeded=False,
            candidate_asset_id="asset_fake_0001",
            failure_reason="model timeout",
        )


def test_failed_outcome_requires_failure_reason() -> None:
    with pytest.raises(ValueError, match="failure_reason"):
        GenerationOutcome(
            render_job_id="job_0001",
            attempt_count=1,
            succeeded=False,
            candidate_asset_id=None,
            failure_reason="",
        )


def test_failed_outcome_with_reason_is_valid() -> None:
    outcome = GenerationOutcome(
        render_job_id="job_0001",
        attempt_count=2,
        succeeded=False,
        candidate_asset_id=None,
        failure_reason="model timeout",
    )
    assert outcome.succeeded is False
