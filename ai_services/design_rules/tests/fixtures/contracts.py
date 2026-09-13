from decimal import Decimal

from curalina_design_rules.pipeline import NormalizedRoom, ValidatedLayout
from curalina_design_rules.types import (
    Color,
    DesignProfile,
    HomeCategory,
    HomeCategoryRules,
    HslCaps,
    Money,
    Placement,
    Point,
    Product,
    ProductAttributes,
    ProductCategory,
    ProductInstance,
    RoomGeometry,
    RoomType,
    RuleMetadata,
    RuleResult,
    RuleSet,
    RuleStatus,
    Severity,
    StyleCode,
    StyleRules,
    Violation,
)


def sample_color() -> Color:
    return Color(hex="#f7f2ea", h_deg=38, s_pct=45, l_pct=94)


def sample_profile() -> DesignProfile:
    return DesignProfile(
        profile_id="profile_om_001",
        style=StyleCode.OM,
        tonality="light_warm",
        room_intent="calm living room",
    )


def sample_product() -> Product:
    return Product(
        product_id="prod_sofa_001",
        name="Bench Sofa",
        category=ProductCategory.SOFA,
        width_mm=2134,
        depth_mm=914,
        height_mm=787,
        price=Money(amount=Decimal("1200.00"), currency="CAD"),
        attributes=ProductAttributes(curved_edges=True, in_proportion_scope=True),
    )


def sample_geometry() -> RoomGeometry:
    return RoomGeometry(
        room_id="room_001",
        room_type=RoomType.LIVING_ROOM,
        home_category=HomeCategory.CONDO,
        boundary=(
            Point(0, 0),
            Point(3658, 0),
            Point(3658, 4267),
            Point(0, 4267),
        ),
        ceiling_height_mm=2438,
    )


def sample_placement() -> Placement:
    return Placement(
        instance=ProductInstance(instance_id="inst_sofa_001", product=sample_product()),
        x_mm=610,
        y_mm=914,
        rotation_deg=0,
    )


def sample_rule_metadata() -> RuleMetadata:
    return RuleMetadata(
        rule_id="CMR_VALIDATION",
        source_section="9 implementation note, 10 STEP 5",
        rules_version="rules-0.0.0",
        status=RuleStatus.BLOCKED,
        open_question_id="OQ-001",
    )


def sample_rule_result() -> RuleResult:
    return RuleResult(violations=(), rules_version="rules-0.0.0")


def sample_blocked_result() -> RuleResult:
    metadata = sample_rule_metadata()
    return RuleResult(
        violations=(
            Violation(
                rule_id=metadata.rule_id,
                severity=Severity.NEEDS_INPUT,
                message="CMR formula is undefined.",
                source_section=metadata.source_section,
                subject_ids=("room_001",),
                open_question_id=metadata.open_question_id,
            ),
        ),
        rules_version=metadata.rules_version,
    )


def sample_validated_layout() -> ValidatedLayout:
    room = NormalizedRoom(
        geometry=sample_geometry(),
        recommended_wall_color=sample_color(),
        existing_wall_color=None,
    )
    return ValidatedLayout(
        placements=(sample_placement(),),
        normalized_room=room,
        spatial_result=sample_rule_result(),
    )


def sample_ruleset() -> RuleSet:
    return RuleSet(
        rules_version="rules-0.0.0",
        styles=(
            StyleRules(
                style_code="OM",
                hsl_caps=HslCaps(
                    saturation_max_pct=55,
                    lightness_range_pct=(70, 98),
                ),
            ),
        ),
        home_categories=(
            HomeCategoryRules(category="condo", min_walkway_mm=813),
        ),
        metadata=(
            sample_rule_metadata(),
            RuleMetadata(
                rule_id="ANCHOR_NODE_HEX_LIBRARY",
                source_section="3.5 Gate 1",
                rules_version="rules-0.0.0",
                status=RuleStatus.BLOCKED,
                open_question_id="OQ-007",
            ),
        ),
    )
