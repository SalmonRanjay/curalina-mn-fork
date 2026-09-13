"""Geometric primitives for the §9 spatial engine.

Works in integer millimetres throughout (converted once at load time — see
`spatial/loader.py`). Uses Shapely for polygon algebra, per the technical
design (`agentic_flow/12_design_rules_engine.md`, "Spatial engine (§9)").
"""

from itertools import combinations

from shapely import affinity
from shapely.geometry import MultiPolygon, Polygon, box
from shapely.geometry import Point as ShapelyPoint
from shapely.geometry.base import BaseGeometry
from shapely.ops import unary_union

from curalina_design_rules.types import (
    Placement,
    Point,
    RoomGeometry,
    Severity,
    Violation,
)

# Tolerance for floating-point noise in Shapely area/geometry comparisons.
# Areas are in mm^2; 1.0 mm^2 is far below anything a placement rule cares about.
_AREA_TOLERANCE_MM2 = 1.0

# A corridor exactly `min_walkway_mm` wide erodes to a zero-width sliver at
# the midpoint of the opening test; buffering a degenerate zero-width strip
# back out is numerically unreliable. Shaving a fraction of a millimetre off
# the erosion radius keeps a boundary-exact corridor a real (if hair-thin)
# polygon so it reliably dilates back to its original width, while a
# corridor even 1mm narrower than the requirement still collapses to empty.
_OPENING_EPSILON_MM = 0.4


def footprint(placement: Placement) -> Polygon:
    """Exact supplier W x D at the placed position and rotation.

    Section 9 invariant SPATIAL_TRUE_DIMENSIONS: no scaling, ever.
    """
    product = placement.instance.product
    rect = box(0, 0, product.width_mm, product.depth_mm)
    rotated = affinity.rotate(rect, placement.rotation_deg, origin=(0, 0))
    return affinity.translate(rotated, xoff=placement.x_mm, yoff=placement.y_mm)


def room_polygon(room: RoomGeometry) -> Polygon:
    return Polygon([(point.x_mm, point.y_mm) for point in room.boundary])


def check_collisions(
    placements: tuple[Placement, ...],
) -> tuple[Violation, ...]:
    """§9 implementation note: NO_PLACEMENT_ON_VIOLATION.

    Two overlapping footprints produce one HARD violation naming both
    instance IDs.
    """
    out: list[Violation] = []
    for placement_a, placement_b in combinations(placements, 2):
        footprint_a = footprint(placement_a)
        footprint_b = footprint(placement_b)
        overlap = footprint_a.intersection(footprint_b).area
        if overlap > _AREA_TOLERANCE_MM2:
            out.append(
                Violation(
                    rule_id="NO_PLACEMENT_ON_VIOLATION",
                    severity=Severity.HARD,
                    message=(
                        f"{placement_a.product_id} overlaps {placement_b.product_id}"
                    ),
                    source_section="Section 9 implementation note",
                    subject_ids=(placement_a.instance_id, placement_b.instance_id),
                    measured=overlap,
                    required=0.0,
                )
            )
    return tuple(out)


def _free_area(placements: tuple[Placement, ...], room: RoomGeometry) -> BaseGeometry:
    occupied = (
        unary_union([footprint(placement) for placement in placements])
        if placements
        else Polygon()
    )
    return room_polygon(room).difference(occupied)


def has_walkway(free: BaseGeometry, min_walkway_mm: int) -> bool:
    """Erode-then-dilate (morphological opening) test.

    A corridor narrower than `min_walkway_mm` does not survive an opening by
    half its width — this is the primitive `12_design_rules_engine.md`
    specifies for every §9 walkway/reachability rule.
    """
    half = min_walkway_mm / 2.0
    passable = _erode_dilate(free, half)
    pinched = free.difference(passable)
    return bool(pinched.area <= _AREA_TOLERANCE_MM2)


def _erode_dilate(geom: BaseGeometry, half: float) -> BaseGeometry:
    """Morphological opening with mitred joins/flat caps so axis-aligned
    rectilinear corridors erode and dilate back to their exact width instead
    of losing area to round-join approximation."""
    radius = max(half - _OPENING_EPSILON_MM, 0.0)
    eroded = geom.buffer(-radius, join_style="mitre", cap_style="flat")
    return eroded.buffer(radius, join_style="mitre", cap_style="flat")


def check_walkways(
    placements: tuple[Placement, ...],
    room: RoomGeometry,
    min_walkway_mm: int,
) -> tuple[Violation, ...]:
    """§9.1 minimum walkway by home category: condo 32", mid 36", large 48-60"."""
    free = _free_area(placements, room)
    if has_walkway(free, min_walkway_mm):
        return ()
    return (
        Violation(
            rule_id="MIN_WALKWAY",
            severity=Severity.HARD,
            message=f"No continuous walkway of at least {min_walkway_mm}mm found",
            source_section="9.1",
            subject_ids=tuple(placement.instance_id for placement in placements),
            measured=float(min_walkway_mm - 1),
            required=float(min_walkway_mm),
        ),
    )


def _component_containing(
    geom: BaseGeometry, point: ShapelyPoint
) -> BaseGeometry | None:
    candidates: list[BaseGeometry]
    if isinstance(geom, MultiPolygon):
        candidates = list(geom.geoms)
    else:
        candidates = [geom]
    for candidate in candidates:
        if candidate.buffer(_AREA_TOLERANCE_MM2).contains(point):
            return candidate
    return None


def check_reachability(
    placements: tuple[Placement, ...],
    room: RoomGeometry,
    origin: Point,
    destination: Point,
    min_width_mm: int,
) -> bool:
    """Is `origin` reachable from `destination` through a corridor >= min_width_mm?

    Implemented as the graph-reachability check `12_design_rules_engine.md`
    specifies: both endpoints must fall in the same connected component of
    the opened (eroded-then-dilated) free-space polygon.
    """
    free = _free_area(placements, room)
    half = min_width_mm / 2.0
    passable = _erode_dilate(free, half)
    origin_point = ShapelyPoint(origin.x_mm, origin.y_mm)
    destination_point = ShapelyPoint(destination.x_mm, destination.y_mm)
    origin_component = _component_containing(passable, origin_point)
    destination_component = _component_containing(passable, destination_point)
    if origin_component is None or destination_component is None:
        return False
    return bool(origin_component.equals(destination_component))
