import pytest
from factories import (
    make_bounding_box,
    make_instance,
    make_room_prep_result,
    make_styled_room,
)

from curalina_rooms.adapters.fake_grounded_generation import (
    FakeGroundedGenerationAdapter,
)
from curalina_rooms.application.generate_room import generate_room
from curalina_rooms.domain.errors import MaxAttemptsExceededError
from curalina_rooms.domain.generation_outcome import GenerationOutcome
from curalina_rooms.domain.render_job import CommercialAvailability, JobStatus
from curalina_rooms.domain.render_plan import PlannedInsertion, RenderPlan


class _AlwaysFailingAdapter:
    """Test-only fake used to exercise `generate_room`'s failure path."""

    def generate(self, plan: RenderPlan) -> GenerationOutcome:
        return GenerationOutcome(
            render_job_id=plan.render_job_id,
            attempt_count=1,
            succeeded=False,
            candidate_asset_id=None,
            failure_reason="fake adapter always fails",
        )


def _make_plan() -> RenderPlan:
    insertion = PlannedInsertion(
        instance=make_instance(), image_space_box=make_bounding_box(), order_index=0
    )
    return RenderPlan(
        render_job_id="job_0001",
        styled_room=make_styled_room(),
        room_prep=make_room_prep_result(),
        insertions=(insertion,),
        prompt_version="prompt-v1",
        negative_constraints=("blurry",),
        rules_version="fixture-1.0",
    )


def test_generate_room_succeeds_with_fake_adapter() -> None:
    result = generate_room(
        _make_plan(),
        adapter=FakeGroundedGenerationAdapter(),
        max_attempts=3,
        prior_attempt_count=0,
        commercial_availability=CommercialAvailability.CONCEPTUAL,
    )

    assert result.job_state.job_status is JobStatus.SUCCEEDED
    assert result.job_state.attempt_count == 1
    assert result.job_state.candidate_id == result.outcome.candidate_asset_id
    assert result.job_state.commercial_availability is CommercialAvailability.CONCEPTUAL


def test_generate_room_records_failure_without_a_candidate() -> None:
    result = generate_room(
        _make_plan(),
        adapter=_AlwaysFailingAdapter(),
        max_attempts=3,
        prior_attempt_count=0,
        commercial_availability=CommercialAvailability.UNKNOWN,
    )

    assert result.job_state.job_status is JobStatus.FAILED
    assert result.job_state.candidate_id is None
    assert result.outcome.succeeded is False


def test_generate_room_raises_when_max_attempts_exceeded() -> None:
    with pytest.raises(MaxAttemptsExceededError):
        generate_room(
            _make_plan(),
            adapter=FakeGroundedGenerationAdapter(),
            max_attempts=3,
            prior_attempt_count=3,
            commercial_availability=CommercialAvailability.UNKNOWN,
        )
