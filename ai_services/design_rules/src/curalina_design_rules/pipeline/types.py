from dataclasses import dataclass

from curalina_design_rules.types.geometry import Placement, RoomGeometry
from curalina_design_rules.types.palette import (
    LightingPlan,
    MaterialAssignment,
    Palette,
)
from curalina_design_rules.types.primitives import Color
from curalina_design_rules.types.results import RuleResult


@dataclass(frozen=True)
class NormalizedRoom:
    geometry: RoomGeometry
    recommended_wall_color: Color
    existing_wall_color: Color | None


@dataclass(frozen=True)
class ValidatedLayout:
    placements: tuple[Placement, ...]
    normalized_room: NormalizedRoom
    spatial_result: RuleResult


@dataclass(frozen=True)
class StyledRoom:
    layout: ValidatedLayout
    palette: Palette
    material_assignment: MaterialAssignment
    lighting_plan: LightingPlan
