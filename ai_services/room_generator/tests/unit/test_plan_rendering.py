from factories import (
    make_render_request,
    make_room_prep_result,
    make_styled_room,
    validate,
)

from curalina_rooms.application.plan_rendering import (
    NEGATIVE_CONSTRAINTS,
    build_render_plan,
)


def test_build_render_plan_produces_one_insertion_per_instance() -> None:
    request = make_render_request()
    validated = validate(request)

    plan = build_render_plan(
        validated,
        render_job_id="job_0001",
        styled_room=make_styled_room(),
        room_prep=make_room_prep_result(),
        prompt_version="prompt-v1",
        rules_version="fixture-1.0",
    )

    assert len(plan.insertions) == len(request.instances)
    assert plan.negative_constraints == NEGATIVE_CONSTRAINTS
    assert plan.insertions[0].instance_id == request.instances[0].instance_id
