"""Image-space bounding boxes used to validate a render plan.

This is deliberately *not* the homography/geometry-extraction logic G01 is
meant to prove out. It is a pure box-overlap helper that operates on
coordinates that are already given to it (by a fixture in tests, or by a
future `RoomPrepAdapter` once G01 clears) — it never estimates those
coordinates from an image. See `curalina_rooms.ports.room_prep` for the
port that will eventually produce these coordinates for real.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class BoundingBox:
    """A box in normalized image-space coordinates, both axes in `[0, 1]`."""

    x0: float
    y0: float
    x1: float
    y1: float

    def __post_init__(self) -> None:
        for name, value in (("x0", self.x0), ("y0", self.y0)):
            if not 0.0 <= value <= 1.0:
                raise ValueError(f"{name} must be within [0, 1], got {value}")
        for name, value in (("x1", self.x1), ("y1", self.y1)):
            if not 0.0 <= value <= 1.0:
                raise ValueError(f"{name} must be within [0, 1], got {value}")
        if self.x1 <= self.x0:
            raise ValueError(f"x1 ({self.x1}) must be greater than x0 ({self.x0})")
        if self.y1 <= self.y0:
            raise ValueError(f"y1 ({self.y1}) must be greater than y0 ({self.y0})")

    def overlaps(self, other: BoundingBox) -> bool:
        return (
            self.x0 < other.x1
            and other.x0 < self.x1
            and self.y0 < other.y1
            and other.y0 < self.y1
        )
