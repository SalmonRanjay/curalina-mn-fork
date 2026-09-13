"""The render plan: the immutable, fully-resolved instruction set a
`GroundedGenerationAdapter` consumes.

Per `agentic_flow/14_room_generation_technical_design.md`'s central design
decision, the renderer never decides styling — it "photographs" a
`StyledRoom` that `curalina_design_rules` already produced. `RenderPlan`
wraps that `StyledRoom` directly (imported from `curalina_design_rules`,
not re-typed) alongside the room-generator-specific facts the renderer also
needs: ordered product insertions with explicit instance IDs, protected
regions, and the prompt/negative-constraint versioning that
`06_room_generation.md` requires be recorded alongside `rules_version`.
"""

from __future__ import annotations

from dataclasses import dataclass

from curalina_design_rules.pipeline.types import StyledRoom

from curalina_rooms.domain.errors import DuplicateInstanceIdError
from curalina_rooms.domain.geometry import BoundingBox
from curalina_rooms.domain.render_request import RenderRequestInstance
from curalina_rooms.domain.room_prep import ProtectedRegion, RoomPrepResult


@dataclass(frozen=True)
class PlannedInsertion:
    """One ordered insertion into the render, per
    `06_room_generation.md` step 4 ("ordered insertions, source IDs, masks
    and model-specific controls")."""

    instance: RenderRequestInstance
    image_space_box: BoundingBox
    order_index: int

    def __post_init__(self) -> None:
        if self.order_index < 0:
            raise ValueError("order_index must be >= 0")

    @property
    def instance_id(self) -> str:
        return self.instance.instance_id


@dataclass(frozen=True)
class RenderPlan:
    """Immutable input snapshot for one render job attempt.

    Frozen and built entirely from tuples so that mutating a caller's
    source list after construction cannot retroactively change an
    already-built plan — see the "immutable input snapshots" test in
    `agentic_flow/room_generator_workflow.md`'s A2 mandatory-tests list.
    """

    render_job_id: str
    styled_room: StyledRoom
    room_prep: RoomPrepResult
    insertions: tuple[PlannedInsertion, ...]
    prompt_version: str
    negative_constraints: tuple[str, ...]
    rules_version: str

    def __post_init__(self) -> None:
        if not self.render_job_id.strip():
            raise ValueError("render_job_id is required")
        if not self.insertions:
            raise ValueError("a render plan requires at least one insertion")
        seen: set[str] = set()
        for insertion in self.insertions:
            if insertion.instance_id in seen:
                raise DuplicateInstanceIdError(insertion.instance_id)
            seen.add(insertion.instance_id)

    @property
    def protected_regions(self) -> tuple[ProtectedRegion, ...]:
        return self.room_prep.protected_regions
