"""Synthetic default room dimensions for E2E/demo rendering.

Per `ADR-0015`, when room geometry is not available (measured, from floorplan,
or inferred), the system may use stated default dimensions per room/home
category to enable E2E/demo progress. These defaults are **not evidence** and
must be labelled as `synthetic_defaults` in all outputs.

This module provides reasonable demo defaults. Choices are explicitly
arbitrary and documented here rather than in code so they can be easily
reviewed and adjusted.
"""

from __future__ import annotations

from curalina_design_rules.types.geometry import Point, RoomGeometry
from curalina_design_rules.types.primitives import Color, HomeCategory, RoomType


def create_synthetic_room_geometry(
    *, room_type: RoomType, home_category: HomeCategory, room_id: str
) -> RoomGeometry:
    """Create synthetic default room geometry.

    Dimensions are arbitrary defaults chosen for demo/E2E purposes, keyed by
    room type and home category. A real room would use measured or floorplan
    geometry instead.

    Args:
        room_type: The type of room (living room, bedroom, etc.)
        home_category: The home category tier (e.g., MID, PREMIUM)
        room_id: The room identifier to embed in the geometry

    Returns:
        A RoomGeometry with synthetic default dimensions.

    Dimensions chosen:
    - Living room: 4000mm × 3000mm (13' 1" × 9' 10" approx)
      - Typical open-concept living area
      - Ceiling 2400mm (7' 10") for standard residential
    - Bedroom: 3500mm × 3000mm (11' 6" × 9' 10")
      - Standard master bedroom dimensions
      - Ceiling 2400mm
    - Dining room: 3800mm × 3200mm (12' 6" × 10' 6")
      - Accommodates a dining table and circulation
      - Ceiling 2400mm
    - Other rooms: 3500mm × 3000mm (fallback)

    These are deliberately nominal demo sizes, not derived from any building
    code or real data.
    """
    # Dimensions in millimetres (integer, per stack requirement)
    if room_type == RoomType.LIVING_ROOM:
        width_mm = 4000
        depth_mm = 3000
    elif room_type == RoomType.BEDROOM:
        width_mm = 3500
        depth_mm = 3000
    elif room_type == RoomType.DINING_ROOM:
        width_mm = 3800
        depth_mm = 3200
    else:
        # Fallback for unspecified room types
        width_mm = 3500
        depth_mm = 3000

    ceiling_height_mm = 2400  # Standard residential ceiling

    return RoomGeometry(
        room_id=room_id,
        room_type=room_type,
        home_category=home_category,
        boundary=(
            Point(x_mm=0, y_mm=0),
            Point(x_mm=width_mm, y_mm=0),
            Point(x_mm=width_mm, y_mm=depth_mm),
            Point(x_mm=0, y_mm=depth_mm),
        ),
        ceiling_height_mm=ceiling_height_mm,
    )


def create_synthetic_wall_color() -> Color:
    """Create a neutral synthetic wall color for demo rendering.

    Returns a light neutral color suitable for a demo/synthetic room.
    """
    return Color(hex="#EDE7DD", h_deg=38, s_pct=24, l_pct=91)
