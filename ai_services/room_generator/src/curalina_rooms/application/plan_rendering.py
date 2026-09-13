"""`PlanRendering` — build a `RenderPlan` from a validated request, a
`StyledRoom` and a `RoomPrepAdapter` result.

Per `06_room_generation.md` step 4: "ordered insertions, source IDs, masks
and model-specific controls. Record prompt version and negative
constraints." Depth-sorting insertions for real occlusion order needs real
geometry (blocked on G01); this fake-adapter-scope build orders insertions
by the sequence the caller supplied, which is sufficient to exercise
`RenderPlan`'s invariants (duplicate instance IDs, non-empty insertions).
"""

from __future__ import annotations

from curalina_design_rules.pipeline.types import StyledRoom

from curalina_rooms.application.validate_render_request import ValidatedRenderRequest
from curalina_rooms.domain.render_plan import PlannedInsertion, RenderPlan
from curalina_rooms.domain.room_prep import RoomPrepResult

NEGATIVE_CONSTRAINTS: tuple[str, ...] = (
    "duplicate furniture",
    "extra sofa",
    "floating furniture",
    "warped perspective",
    "distorted proportions",
    "additional windows",
    "additional doors",
    "text",
    "watermark",
    "blurry",
    "oversaturated",
)


def build_render_plan(
    validated: ValidatedRenderRequest,
    *,
    render_job_id: str,
    styled_room: StyledRoom,
    room_prep: RoomPrepResult,
    prompt_version: str,
    rules_version: str,
) -> RenderPlan:
    insertions = tuple(
        PlannedInsertion(
            instance=instance,
            image_space_box=validated.reference_assets_by_id[
                instance.reference_asset_id
            ].image_space_box,
            order_index=index,
        )
        for index, instance in enumerate(validated.request.instances)
    )
    return RenderPlan(
        render_job_id=render_job_id,
        styled_room=styled_room,
        room_prep=room_prep,
        insertions=insertions,
        prompt_version=prompt_version,
        negative_constraints=NEGATIVE_CONSTRAINTS,
        rules_version=rules_version,
    )
