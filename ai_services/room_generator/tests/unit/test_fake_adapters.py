"""Fake adapters must be deterministic and must never claim a certified
measurement or a verified render."""

from factories import (
    make_bounding_box,
    make_instance,
    make_room_prep_result,
    make_styled_room,
)

from curalina_rooms.adapters.fake_grounded_generation import (
    FakeGroundedGenerationAdapter,
)
from curalina_rooms.adapters.fake_room_prep import FakeRoomPrepAdapter
from curalina_rooms.domain.render_plan import PlannedInsertion, RenderPlan
from curalina_rooms.domain.room_prep import (
    ProtectedRegionKind,
    RoomPrepRequest,
    RoomPrepSource,
)


def test_fake_room_prep_is_deterministic_and_labelled_fake() -> None:
    adapter = FakeRoomPrepAdapter()
    requested_kinds = (ProtectedRegionKind.DOOR, ProtectedRegionKind.WINDOW)
    request = RoomPrepRequest(
        room_asset_id="asset_room_0001",
        requested_protected_region_kinds=requested_kinds,
    )

    first = adapter.prepare(request)
    second = adapter.prepare(request)

    assert first == second
    assert first.source is RoomPrepSource.FAKE_FIXTURE
    assert first.measurement_certified is False
    assert {region.kind for region in first.protected_regions} == {
        ProtectedRegionKind.DOOR,
        ProtectedRegionKind.WINDOW,
    }


def test_fake_grounded_generation_is_deterministic_and_placeholder_only() -> None:
    adapter = FakeGroundedGenerationAdapter()
    insertion = PlannedInsertion(
        instance=make_instance(), image_space_box=make_bounding_box(), order_index=0
    )
    plan = RenderPlan(
        render_job_id="job_0001",
        styled_room=make_styled_room(),
        room_prep=make_room_prep_result(),
        insertions=(insertion,),
        prompt_version="prompt-v1",
        negative_constraints=("blurry",),
        rules_version="fixture-1.0",
    )

    first = adapter.generate(plan)
    second = adapter.generate(plan)

    assert first == second
    assert first.succeeded is True
    assert first.candidate_asset_id is not None
    assert first.candidate_asset_id.startswith("asset_fake_")
