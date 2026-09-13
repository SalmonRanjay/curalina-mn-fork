import re
from dataclasses import dataclass
from enum import StrEnum

_OPEN_QUESTION_RE = re.compile(r"^OQ-\d{3}$")


class RuleStatus(StrEnum):
    ACTIVE = "active"
    BLOCKED = "blocked"


@dataclass(frozen=True)
class HslCaps:
    saturation_max_pct: int
    lightness_range_pct: tuple[int, int]
    hue_range_deg: tuple[int, int] | None = None


@dataclass(frozen=True)
class StyleRules:
    style_code: str
    hsl_caps: HslCaps


@dataclass(frozen=True)
class HomeCategoryRules:
    category: str
    min_walkway_mm: int

    def __post_init__(self) -> None:
        _require_int("min_walkway_mm", self.min_walkway_mm)


@dataclass(frozen=True)
class RuleMetadata:
    rule_id: str
    source_section: str
    rules_version: str
    status: RuleStatus
    open_question_id: str | None = None

    def __post_init__(self) -> None:
        if not self.source_section.strip():
            raise ValueError("source_section is required")
        if self.status is RuleStatus.BLOCKED:
            if self.open_question_id is None:
                raise ValueError("blocked rules require open_question_id")
            if _OPEN_QUESTION_RE.fullmatch(self.open_question_id) is None:
                raise ValueError("open_question_id must match OQ-xxx")


@dataclass(frozen=True)
class StyleSpacingRule:
    style_code: str
    min_mm: int
    max_mm: int

    def __post_init__(self) -> None:
        _require_int("min_mm", self.min_mm)
        _require_int("max_mm", self.max_mm)


@dataclass(frozen=True)
class SpatialRuleTable:
    """Named §9 thresholds, converted once to integer millimetres at load time.

    Every field here traces to a `source` key in ``spatial_rules.yaml`` — see
    ``spatial/loader.py::load_spatial_rule_table`` for the exact YAML path
    each field is read from. Nothing here is an invented default.
    """

    rules_version: str
    sofa_to_table_mm: tuple[StyleSpacingRule, ...]
    rug_front_leg_min_mm: int
    media_sightline_center_mm: int
    floating_anchor_room_width_threshold_mm: int
    floating_anchor_min_clearance_mm: int
    twin_nightstand_categories: tuple[str, ...]
    rug_landing_strip_min_mm: int
    ensuite_path_min_mm: int
    closet_path_min_mm: int
    dr_pull_back_min_mm: int
    dr_pull_back_with_walkway_mm: int
    dr_credenza_buffer_min_mm: int
    dr_credenza_min_fraction: float
    sightline_12in_threshold_mm: int

    def sofa_to_table_for(self, style_code: str) -> StyleSpacingRule | None:
        for rule in self.sofa_to_table_mm:
            if rule.style_code == style_code:
                return rule
        return None


@dataclass(frozen=True)
class RuleSet:
    rules_version: str
    styles: tuple[StyleRules, ...]
    home_categories: tuple[HomeCategoryRules, ...]
    metadata: tuple[RuleMetadata, ...] = ()
    spatial_rule_table: SpatialRuleTable | None = None

    def metadata_by_rule_id(self) -> dict[str, RuleMetadata]:
        return {item.rule_id: item for item in self.metadata}


def _require_int(field_name: str, value: int) -> None:
    if not isinstance(value, int) or isinstance(value, bool):
        raise TypeError(f"{field_name} must be an integer millimetre value")
