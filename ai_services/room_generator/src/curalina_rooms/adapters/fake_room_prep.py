"""`FakeRoomPrepAdapter` — deterministic, explicitly fake `RoomPrepAdapter`.

This is **not** a homography or measurement estimator. It returns a canned
`NormalizedRoom` and a fixed set of protected regions from an in-memory
fixture, keyed only by `room_asset_id` so the same input always returns the
same output. It exists so `application/` and A3's job lifecycle can be
exercised end-to-end before G01 clears. Every result carries
`source=RoomPrepSource.FAKE_FIXTURE` and `measurement_certified=False` so
nothing downstream can mistake it for a real measurement.
"""

from __future__ import annotations

from curalina_design_rules.pipeline.types import NormalizedRoom
from curalina_design_rules.types.geometry import Point, RoomGeometry
from curalina_design_rules.types.primitives import Color, HomeCategory, RoomType

from curalina_rooms.domain.geometry import BoundingBox
from curalina_rooms.domain.room_prep import (
    ProtectedRegion,
    ProtectedRegionKind,
    RoomPrepRequest,
    RoomPrepResult,
    RoomPrepSource,
)

_FAKE_WALL_COLOR = Color(hex="#EDE7DD", h_deg=38, s_pct=24, l_pct=91)


class FakeRoomPrepAdapter:
    """Fake `RoomPrepAdapter` implementation. Deterministic and fast."""

    def prepare(self, request: RoomPrepRequest) -> RoomPrepResult:
        geometry = RoomGeometry(
            room_id=f"fake-geometry:{request.room_asset_id}",
            room_type=RoomType.LIVING_ROOM,
            home_category=HomeCategory.MID,
            boundary=(
                Point(x_mm=0, y_mm=0),
                Point(x_mm=4000, y_mm=0),
                Point(x_mm=4000, y_mm=3000),
                Point(x_mm=0, y_mm=3000),
            ),
            ceiling_height_mm=2400,
        )
        normalized_room = NormalizedRoom(
            geometry=geometry,
            recommended_wall_color=_FAKE_WALL_COLOR,
            existing_wall_color=None,
        )
        protected_regions = tuple(
            ProtectedRegion(
                region_id=f"fake-region:{request.room_asset_id}:{kind.value}",
                kind=kind,
                image_space_box=_FAKE_REGION_BOXES[kind],
            )
            for kind in request.requested_protected_region_kinds
        )
        return RoomPrepResult(
            normalized_room=normalized_room,
            protected_regions=protected_regions,
            homography_reference=None,
            measurement_certified=False,
            source=RoomPrepSource.FAKE_FIXTURE,
        )


_FAKE_REGION_BOXES: dict[ProtectedRegionKind, BoundingBox] = {
    ProtectedRegionKind.DOOR: BoundingBox(x0=0.02, y0=0.10, x1=0.14, y1=0.90),
    ProtectedRegionKind.WINDOW: BoundingBox(x0=0.80, y0=0.15, x1=0.98, y1=0.55),
    ProtectedRegionKind.RETAINED_OBJECT: BoundingBox(
        x0=0.40, y0=0.60, x1=0.55, y1=0.85
    ),
}
