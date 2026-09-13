"""Domain types for room preparation: geometry normalization, homography and
protected-region masks.

These types describe the *output* of `curalina_rooms.ports.room_prep`'s
`RoomPrepAdapter` port. The real implementation is blocked on G01 (the
room-prep/homography notebook, `architecture/notebooks/room_generator/
01_room_inputs.ipynb`) — see that port's docstring. Independently of G01,
`OQ-010` (room geometry/measurement source,
`agentic_flow/open_questions.yaml`) means no instance of `RoomPrepResult`
may claim a certified room-scale measurement; `measurement_certified` is
therefore hard-pinned to `False` here (see its `__post_init__`) rather than
left as a field a careless caller could set to `True`.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum

from curalina_design_rules.pipeline.types import NormalizedRoom

from curalina_rooms.domain.geometry import BoundingBox


class ProtectedRegionKind(StrEnum):
    """What a protected image-space region guards against alteration."""

    DOOR = "door"
    WINDOW = "window"
    RETAINED_OBJECT = "retained_object"


class RoomPrepSource(StrEnum):
    """Provenance of a `RoomPrepResult`.

    `FAKE_FIXTURE` is the only value the fake-adapter scope of this service
    produces. `MANUAL_ANNOTATION` and `CUSTOMER_CONFIRMED` name the real
    sources G01's notebook is meant to validate — they are listed here so
    the domain vocabulary is ready, not because a real adapter exists yet.
    """

    FAKE_FIXTURE = "fake_fixture"
    MANUAL_ANNOTATION = "manual_annotation"
    CUSTOMER_CONFIRMED = "customer_confirmed"


@dataclass(frozen=True)
class ProtectedRegion:
    """An image-space region (a door, window or retained object) that a
    generation pass must not alter."""

    region_id: str
    kind: ProtectedRegionKind
    image_space_box: BoundingBox
    note: str = ""

    def __post_init__(self) -> None:
        if not self.region_id.strip():
            raise ValueError("region_id is required")


@dataclass(frozen=True)
class RoomPrepRequest:
    """Input to `RoomPrepAdapter.prepare`.

    `room_asset_id` must already have been imported via `POST /v1/assets`
    (see `architecture/guides/03_data_contracts.md`'s cross-service
    consumption rule) — this service never accepts a bare filesystem path.
    """

    room_asset_id: str
    requested_protected_region_kinds: tuple[ProtectedRegionKind, ...] = ()

    def __post_init__(self) -> None:
        if not self.room_asset_id.strip():
            raise ValueError("room_asset_id is required")


@dataclass(frozen=True)
class RoomPrepResult:
    """Output of `RoomPrepAdapter.prepare`.

    Reuses `curalina_design_rules`'s `NormalizedRoom` directly rather than
    re-typing room geometry that dependency already owns (per
    `agentic_flow/14_room_generation_technical_design.md` and this
    service's A2 work packet).
    """

    normalized_room: NormalizedRoom
    protected_regions: tuple[ProtectedRegion, ...]
    homography_reference: str | None
    measurement_certified: bool
    source: RoomPrepSource

    def __post_init__(self) -> None:
        if self.measurement_certified:
            # OQ-010 is unresolved: no single photograph certifies physical
            # dimensions (`agentic_flow/14_room_generation_technical_design.md`,
            # `architecture/guides/10_source_audit.md`). Flip this only once
            # that open question has a recorded resolution.
            raise ValueError(
                "measurement_certified may not be True while OQ-010 is "
                "unresolved; see curalina_rooms.domain.room_prep.RoomPrepResult"
            )
