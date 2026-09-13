"""Room-generation infrastructure adapters.

Every adapter here is a **fake**: deterministic, fast, no GPU, no model
weights, no network access. Real adapters (SDXL/ControlNet/IP-Adapter
inference, real homography estimation) are out of this phase's scope and
blocked on G01/G02 — see `curalina_rooms.ports` for the ports they will
eventually implement.
"""

from curalina_rooms.adapters.fake_clock import FixedClock
from curalina_rooms.adapters.fake_grounded_generation import (
    FakeGroundedGenerationAdapter,
)
from curalina_rooms.adapters.fake_room_prep import FakeRoomPrepAdapter

__all__ = ["FakeGroundedGenerationAdapter", "FakeRoomPrepAdapter", "FixedClock"]
