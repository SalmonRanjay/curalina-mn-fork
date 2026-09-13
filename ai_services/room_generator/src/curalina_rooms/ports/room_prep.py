"""`RoomPrepAdapter` — room geometry normalization, homography and
protected-region extraction.

**Blocked.** The real implementation of this port is G01's eventual home
(`architecture/notebooks/room_generator/01_room_inputs.ipynb`,
`agentic_flow/14_room_generation_technical_design.md`'s
`estimate_floor_homography`): estimating a floor-plane homography from
manual corner annotations on a real room photo, deriving image-space
protected-region masks for doors/windows/retained objects, and normalizing
room geometry. None of that has a frozen, reviewed notebook run, so no real
implementation of this port may exist yet.

Independently of G01, `OQ-010` (room geometry/measurement source,
`agentic_flow/open_questions.yaml`) is unresolved: a single customer photo
cannot certify real-world dimensions on its own
(`architecture/guides/10_source_audit.md`). `RoomPrepResult.
measurement_certified` is hard-pinned to `False` (see its `__post_init__`)
specifically so that clearing G01 alone would not be enough to start
claiming certified measurements — `OQ-010` is a second, independent gate.

Until both clear, the only implementation of this port is
`curalina_rooms.adapters.fake_room_prep.FakeRoomPrepAdapter`.
"""

from __future__ import annotations

from typing import Protocol

from curalina_rooms.domain.room_prep import RoomPrepRequest, RoomPrepResult


class RoomPrepAdapter(Protocol):
    def prepare(self, request: RoomPrepRequest) -> RoomPrepResult:
        """Normalize a room asset into geometry, homography and protected
        regions. Must return `needs_input` (by raising, in a real
        implementation) rather than silently estimating geometry it cannot
        establish (`architecture/guides/06_room_generation.md` step 3)."""
        ...
