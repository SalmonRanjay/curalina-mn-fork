"""Field-level guard-clause coverage for the small domain records that
`test_render_request_validation.py`, `test_render_plan.py` and friends don't
already exercise end to end."""

import pytest
from factories import (
    make_bounding_box,
    make_instance,
    make_reference_asset,
    make_render_request,
    make_room_prep_result,
    make_styled_room,
)

from curalina_rooms.domain.render_job import (
    CandidateReviewStatus,
    CommercialAvailability,
    JobStatus,
    RenderJobState,
)
from curalina_rooms.domain.render_plan import PlannedInsertion, RenderPlan
from curalina_rooms.domain.room_prep import (
    ProtectedRegion,
    ProtectedRegionKind,
    RoomPrepRequest,
)
from curalina_rooms.domain.validation import (
    ArchitectureValidation,
    InstanceValidation,
    Verdict,
)


def test_render_job_state_requires_render_job_id() -> None:
    with pytest.raises(ValueError, match="render_job_id"):
        RenderJobState(
            render_job_id="",
            job_status=JobStatus.QUEUED,
            review_status=CandidateReviewStatus.NOT_APPLICABLE,
            commercial_availability=CommercialAvailability.UNKNOWN,
            attempt_count=0,
        )


def test_render_job_state_requires_non_negative_attempt_count() -> None:
    with pytest.raises(ValueError, match="attempt_count"):
        RenderJobState(
            render_job_id="job_0001",
            job_status=JobStatus.QUEUED,
            review_status=CandidateReviewStatus.NOT_APPLICABLE,
            commercial_availability=CommercialAvailability.UNKNOWN,
            attempt_count=-1,
        )


def test_with_review_rejects_not_applicable_decision() -> None:
    state = RenderJobState(
        render_job_id="job_0001",
        job_status=JobStatus.SUCCEEDED,
        review_status=CandidateReviewStatus.PENDING,
        commercial_availability=CommercialAvailability.UNKNOWN,
        attempt_count=1,
        candidate_id="asset_fake_0001",
    )
    with pytest.raises(ValueError, match="NOT_APPLICABLE"):
        state.with_review(CandidateReviewStatus.NOT_APPLICABLE)


def test_planned_insertion_requires_non_negative_order_index() -> None:
    with pytest.raises(ValueError, match="order_index"):
        PlannedInsertion(
            instance=make_instance(),
            image_space_box=make_bounding_box(),
            order_index=-1,
        )


def test_render_plan_requires_render_job_id() -> None:
    insertion = PlannedInsertion(
        instance=make_instance(), image_space_box=make_bounding_box(), order_index=0
    )
    with pytest.raises(ValueError, match="render_job_id"):
        RenderPlan(
            render_job_id="",
            styled_room=make_styled_room(),
            room_prep=make_room_prep_result(),
            insertions=(insertion,),
            prompt_version="prompt-v1",
            negative_constraints=(),
            rules_version="fixture-1.0",
        )


def test_reference_asset_info_requires_asset_and_product_id() -> None:
    with pytest.raises(ValueError, match="asset_id"):
        make_reference_asset(asset_id="")
    with pytest.raises(ValueError, match="product_id"):
        make_reference_asset(product_id="")


def test_render_request_instance_requires_fields() -> None:
    with pytest.raises(ValueError, match="instance_id"):
        make_instance(instance_id="")
    with pytest.raises(ValueError, match="product_id"):
        make_instance(product_id="")
    with pytest.raises(ValueError, match="quantity_index"):
        make_instance(quantity_index=0)


def test_protected_region_requires_region_id() -> None:
    with pytest.raises(ValueError, match="region_id"):
        ProtectedRegion(
            region_id="",
            kind=ProtectedRegionKind.DOOR,
            image_space_box=make_bounding_box(),
        )


def test_room_prep_request_requires_room_asset_id() -> None:
    with pytest.raises(ValueError, match="room_asset_id"):
        RoomPrepRequest(room_asset_id="")


def test_instance_validation_requires_instance_id() -> None:
    with pytest.raises(ValueError, match="instance_id"):
        InstanceValidation(
            instance_id="",
            expected_product_id="prod_chair_001",
            present=True,
            identity_score=None,
            color_delta_e=None,
            bbox_iou=None,
            verdict=Verdict.PASS,
        )


def test_architecture_validation_requires_region_id() -> None:
    with pytest.raises(ValueError, match="region_id"):
        ArchitectureValidation(region_id="", verdict=Verdict.PASS)


def test_render_request_requires_at_least_one_instance() -> None:
    with pytest.raises(ValueError, match="at least one instance"):
        make_render_request(instances=())


def test_render_request_requires_positive_max_attempts() -> None:
    with pytest.raises(ValueError, match="max_attempts"):
        make_render_request(max_attempts=0)
