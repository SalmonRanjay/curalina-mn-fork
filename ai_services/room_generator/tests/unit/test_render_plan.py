import dataclasses

import pytest
from factories import (
    make_bounding_box,
    make_instance,
    make_room_prep_result,
    make_styled_room,
)

from curalina_rooms.domain.errors import DuplicateInstanceIdError
from curalina_rooms.domain.render_plan import PlannedInsertion, RenderPlan


def _make_plan(insertions: tuple[PlannedInsertion, ...]) -> RenderPlan:
    return RenderPlan(
        render_job_id="job_0001",
        styled_room=make_styled_room(),
        room_prep=make_room_prep_result(),
        insertions=insertions,
        prompt_version="prompt-v1",
        negative_constraints=("blurry",),
        rules_version="fixture-1.0",
    )


def test_render_plan_requires_at_least_one_insertion() -> None:
    with pytest.raises(ValueError, match="at least one insertion"):
        _make_plan(())


def test_render_plan_rejects_duplicate_instance_ids() -> None:
    dup_instance = make_instance(instance_id="inst_dup")
    insertion_a = PlannedInsertion(
        instance=dup_instance, image_space_box=make_bounding_box(), order_index=0
    )
    insertion_b = PlannedInsertion(
        instance=dup_instance, image_space_box=make_bounding_box(), order_index=1
    )

    with pytest.raises(DuplicateInstanceIdError):
        _make_plan((insertion_a, insertion_b))


def test_render_plan_is_an_immutable_input_snapshot() -> None:
    insertion = PlannedInsertion(
        instance=make_instance(), image_space_box=make_bounding_box(), order_index=0
    )
    plan = _make_plan((insertion,))

    with pytest.raises(dataclasses.FrozenInstanceError):
        plan.render_job_id = "job_changed"  # type: ignore[misc]

    mutable_insertions = list(plan.insertions)
    mutable_insertions.clear()
    assert len(plan.insertions) == 1
