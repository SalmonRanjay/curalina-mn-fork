"""Post-render validation is a typed result only in this phase — every
verdict must come back `NOT_EVALUATED`, never a fabricated `PASS`."""

from factories import (
    make_bounding_box,
    make_instance,
    make_room_prep_result,
    make_styled_room,
)

from curalina_rooms.application.evaluate_room import evaluate_room
from curalina_rooms.domain.generation_outcome import GenerationOutcome
from curalina_rooms.domain.render_plan import PlannedInsertion, RenderPlan
from curalina_rooms.domain.room_prep import ProtectedRegion, ProtectedRegionKind
from curalina_rooms.domain.validation import Verdict


def test_evaluate_room_never_fabricates_a_pass_verdict() -> None:
    protected_region = ProtectedRegion(
        region_id="region_door_0001",
        kind=ProtectedRegionKind.DOOR,
        image_space_box=make_bounding_box(x0=0.0, y0=0.0, x1=0.1, y1=0.1),
    )
    insertion = PlannedInsertion(
        instance=make_instance(), image_space_box=make_bounding_box(), order_index=0
    )
    plan = RenderPlan(
        render_job_id="job_0001",
        styled_room=make_styled_room(),
        room_prep=make_room_prep_result(protected_regions=(protected_region,)),
        insertions=(insertion,),
        prompt_version="prompt-v1",
        negative_constraints=("blurry",),
        rules_version="fixture-1.0",
    )
    outcome = GenerationOutcome(
        render_job_id="job_0001",
        attempt_count=1,
        succeeded=True,
        candidate_asset_id="asset_fake_0001",
        failure_reason=None,
    )

    result = evaluate_room(plan, outcome)

    assert result.fully_not_evaluated
    assert result.counts_by_verdict() == {Verdict.NOT_EVALUATED: 2}
    assert all(iv.blocked_on == "G02" for iv in result.instance_validations)
    assert all(av.blocked_on == "G01" for av in result.architecture_validations)
