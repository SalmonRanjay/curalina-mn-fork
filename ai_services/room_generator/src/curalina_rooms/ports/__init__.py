"""Room-generation service ports.

`RoomPrepAdapter` and `GroundedGenerationAdapter` are both blocked pending
their notebook gates (G01, G02) — see each module's docstring. Only their
fake implementations in `curalina_rooms.adapters` exist so far.
"""

from curalina_rooms.ports.clock import Clock
from curalina_rooms.ports.grounded_generation import GroundedGenerationAdapter
from curalina_rooms.ports.room_prep import RoomPrepAdapter

__all__ = ["Clock", "GroundedGenerationAdapter", "RoomPrepAdapter"]
