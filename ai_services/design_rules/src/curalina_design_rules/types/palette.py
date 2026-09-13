from dataclasses import dataclass

from curalina_design_rules.types.primitives import Color


@dataclass(frozen=True)
class Palette:
    foundation: Color
    accent: Color
    metal: str
    high_luster: bool
    seed: int


@dataclass(frozen=True)
class MaterialAssignment:
    assignments: tuple[tuple[str, str], ...]


@dataclass(frozen=True)
class LightingPlan:
    notes: tuple[str, ...]
