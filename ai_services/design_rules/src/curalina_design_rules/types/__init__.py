"""Shared immutable type definitions for later rule-engine phases."""

from curalina_design_rules.types.catalog import (
    Product,
    ProductAttributes,
    ProductInstance,
)
from curalina_design_rules.types.geometry import Placement, Point, RoomGeometry
from curalina_design_rules.types.palette import (
    LightingPlan,
    MaterialAssignment,
    Palette,
)
from curalina_design_rules.types.primitives import (
    Color,
    HomeCategory,
    Money,
    ProductCategory,
    RoomType,
    StyleCode,
)
from curalina_design_rules.types.profile import DesignProfile
from curalina_design_rules.types.results import RuleResult, Severity, Violation
from curalina_design_rules.types.rules import (
    HomeCategoryRules,
    HslCaps,
    RuleMetadata,
    RuleSet,
    RuleStatus,
    SpatialRuleTable,
    StyleRules,
    StyleSpacingRule,
)

__all__ = [
    "Color",
    "DesignProfile",
    "HomeCategory",
    "HomeCategoryRules",
    "HslCaps",
    "LightingPlan",
    "MaterialAssignment",
    "Money",
    "Palette",
    "Placement",
    "Point",
    "Product",
    "ProductAttributes",
    "ProductCategory",
    "ProductInstance",
    "RoomGeometry",
    "RoomType",
    "RuleResult",
    "RuleMetadata",
    "RuleSet",
    "RuleStatus",
    "Severity",
    "SpatialRuleTable",
    "StyleCode",
    "StyleRules",
    "StyleSpacingRule",
    "Violation",
]
