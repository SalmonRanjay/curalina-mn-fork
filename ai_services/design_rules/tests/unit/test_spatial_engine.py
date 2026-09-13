"""RULES-A2b-01 named test cases.

Names and assertions are reused verbatim from
`agentic_flow/EXAMPLE_work_packet_rules_engine.md`.
"""

from decimal import Decimal

from curalina_design_rules import load_rules
from curalina_design_rules.spatial import (
    check_br_closet_path,
    check_br_ensuite_path,
    check_br_rug_landing_strip,
    check_br_twin_nightstand,
    check_cmr_validation,
    check_collisions,
    check_dr_credenza_buffer,
    check_dr_credenza_proportion,
    check_dr_pull_back,
    check_lr_floating_anchor,
    check_lr_media_sightline,
    check_lr_rug_front_leg,
    check_sightline_12in,
    check_walkways,
    footprint,
)
from curalina_design_rules.types import (
    HomeCategory,
    Money,
    Placement,
    Point,
    Product,
    ProductAttributes,
    ProductCategory,
    ProductInstance,
    RoomGeometry,
    RoomType,
    Severity,
)

RULES = load_rules()
SPATIAL = RULES.spatial_rule_table
assert SPATIAL is not None

IN_TO_MM = 25.4


def _mm(inches: float) -> int:
    return round(inches * IN_TO_MM)


def _product(
    product_id: str,
    width_in: float,
    depth_in: float,
    height_in: float = 30,
    category: ProductCategory = ProductCategory.SOFA,
) -> Product:
    return Product(
        product_id=product_id,
        name=product_id,
        category=category,
        width_mm=_mm(width_in),
        depth_mm=_mm(depth_in),
        height_mm=_mm(height_in),
        price=Money(amount=Decimal("100.00"), currency="CAD"),
        attributes=ProductAttributes(),
    )


def _placement(
    instance_id: str,
    product: Product,
    x_in: float,
    y_in: float,
    rotation_deg: int = 0,
) -> Placement:
    return Placement(
        instance=ProductInstance(instance_id=instance_id, product=product),
        x_mm=_mm(x_in),
        y_mm=_mm(y_in),
        rotation_deg=rotation_deg,
    )


def _room(width_in: float, depth_in: float, category: HomeCategory) -> RoomGeometry:
    return RoomGeometry(
        room_id="room_test",
        room_type=RoomType.LIVING_ROOM,
        home_category=category,
        boundary=(
            Point(0, 0),
            Point(_mm(width_in), 0),
            Point(_mm(width_in), _mm(depth_in)),
            Point(0, _mm(depth_in)),
        ),
    )


# ---------------------------------------------------------------------------
# Walkway boundary
# ---------------------------------------------------------------------------


def test_walkway_boundary_passes_exactly_and_fails_below_for_every_category() -> None:
    for category in RULES.home_categories:
        min_mm = category.min_walkway_mm
        corridor_length_in = 200

        # A straight corridor exactly `min_mm` wide and much longer than it is
        # wide must be judged passable at exactly the boundary.
        passing_room = RoomGeometry(
            room_id="corridor_pass",
            room_type=RoomType.LIVING_ROOM,
            home_category=HomeCategory(category.category),
            boundary=(
                Point(0, 0),
                Point(_mm(corridor_length_in), 0),
                Point(_mm(corridor_length_in), min_mm),
                Point(0, min_mm),
            ),
        )
        passing = check_walkways((), passing_room, min_mm)
        assert passing == ()

        # The same corridor narrowed by 1mm must fail.
        failing_room = RoomGeometry(
            room_id="corridor_fail",
            room_type=RoomType.LIVING_ROOM,
            home_category=HomeCategory(category.category),
            boundary=(
                Point(0, 0),
                Point(_mm(corridor_length_in), 0),
                Point(_mm(corridor_length_in), min_mm - 1),
                Point(0, min_mm - 1),
            ),
        )
        failing = check_walkways((), failing_room, min_mm)
        assert failing != ()
        assert failing[0].rule_id == "MIN_WALKWAY"


# ---------------------------------------------------------------------------
# Unit conversion
# ---------------------------------------------------------------------------


def test_unit_conversion_is_exact_integer_mm_with_no_float_drift() -> None:
    product = _product("prod_sofa", width_in=98, depth_in=32, height_in=28)
    assert product.width_mm == 2489
    assert product.depth_mm == 813
    assert product.height_mm == 711

    # 1,000 round trips through the same conversion path must not drift.
    for _ in range(1000):
        product = _product("prod_sofa", width_in=98, depth_in=32, height_in=28)
        assert product.width_mm == 2489
        assert product.depth_mm == 813
        assert product.height_mm == 711


# ---------------------------------------------------------------------------
# Collision
# ---------------------------------------------------------------------------


def test_collision_produces_one_hard_violation_naming_both_instances() -> None:
    product = _product("prod_a", width_in=40, depth_in=30)
    a = _placement("inst_a", product, x_in=0, y_in=0)
    b = _placement("inst_b", product, x_in=10, y_in=0)  # overlaps by 30in x 30in

    violations = check_collisions((a, b))

    assert len(violations) == 1
    assert violations[0].rule_id == "NO_PLACEMENT_ON_VIOLATION"
    assert violations[0].severity is Severity.HARD
    assert set(violations[0].subject_ids) == {"inst_a", "inst_b"}


# ---------------------------------------------------------------------------
# Rotation
# ---------------------------------------------------------------------------


def test_rotation_90_degrees_computes_correct_footprint() -> None:
    product = _product("prod_rot", width_in=40, depth_in=20)
    placement = _placement("inst_rot", product, x_in=0, y_in=0, rotation_deg=90)

    poly = footprint(placement)
    minx, miny, maxx, maxy = poly.bounds

    # A 90-degree rotation swaps the occupied width/depth extents.
    assert round(maxx - minx) == _mm(20)
    assert round(maxy - miny) == _mm(40)


# ---------------------------------------------------------------------------
# Rug front-leg
# ---------------------------------------------------------------------------


def test_rug_front_leg_passes_at_8in_fails_at_7_9in_large_demands_all_legs_on() -> None:
    required_mm = SPATIAL.rug_front_leg_min_mm
    passing = check_lr_rug_front_leg(
        (required_mm, required_mm), HomeCategory.MID, SPATIAL, "inst_sofa"
    )
    assert passing == ()

    failing = check_lr_rug_front_leg(
        (_mm(7.9), _mm(7.9)), HomeCategory.MID, SPATIAL, "inst_sofa"
    )
    assert failing != ()
    assert failing[0].rule_id == "LR_RUG_FRONT_LEG"

    # Large category: one leg on, one leg off -> fails even though the min
    # inset alone would not have failed a mid-category room.
    large_mixed = check_lr_rug_front_leg(
        (required_mm, 0), HomeCategory.LARGE, SPATIAL, "inst_sofa"
    )
    assert large_mixed != ()


# ---------------------------------------------------------------------------
# Media sightline
# ---------------------------------------------------------------------------


def test_media_sightline_passes_at_1067mm_fails_at_1060mm() -> None:
    assert SPATIAL.media_sightline_center_mm == 1067
    assert check_lr_media_sightline(1067, SPATIAL, "inst_tv") == ()
    failing = check_lr_media_sightline(1060, SPATIAL, "inst_tv")
    assert failing != ()
    assert failing[0].rule_id == "LR_MEDIA_SIGHTLINE"


# ---------------------------------------------------------------------------
# Floating anchor
# ---------------------------------------------------------------------------


def test_floating_anchor_16ft1in_wall_fails_off_wall_passes_15ft11in_exempt() -> None:
    room_width_over = _mm(16 * 12 + 1)  # 16'1"
    room_width_under = _mm(15 * 12 + 11)  # 15'11"

    against_wall = check_lr_floating_anchor(room_width_over, 0, SPATIAL, "inst_sofa")
    assert against_wall != ()
    assert against_wall[0].rule_id == "LR_FLOATING_ANCHOR"

    floating = check_lr_floating_anchor(
        room_width_over, SPATIAL.floating_anchor_min_clearance_mm, SPATIAL, "inst_sofa"
    )
    assert floating == ()

    exempt = check_lr_floating_anchor(room_width_under, 0, SPATIAL, "inst_sofa")
    assert exempt == ()


# ---------------------------------------------------------------------------
# Twin nightstand
# ---------------------------------------------------------------------------


def test_twin_nightstand_mismatched_fails_mid_large_condo_exempt() -> None:
    mismatched_mid = check_br_twin_nightstand(
        HomeCategory.MID, ("prod_a", "prod_b"), SPATIAL, ("inst_a", "inst_b")
    )
    assert mismatched_mid != ()
    assert mismatched_mid[0].rule_id == "BR_TWIN_NIGHTSTAND"

    matched_large = check_br_twin_nightstand(
        HomeCategory.LARGE, ("prod_a", "prod_a"), SPATIAL, ("inst_a", "inst_b")
    )
    assert matched_large == ()

    condo_exempt = check_br_twin_nightstand(
        HomeCategory.CONDO, ("prod_a", "prod_b"), SPATIAL, ("inst_a", "inst_b")
    )
    assert condo_exempt == ()


# ---------------------------------------------------------------------------
# Rug landing strip
# ---------------------------------------------------------------------------


def test_rug_landing_strip_24in_passes_ending_at_frame_is_critical_error() -> None:
    required = SPATIAL.rug_landing_strip_min_mm
    passing = check_br_rug_landing_strip(
        (required, required, required), SPATIAL, "inst_rug"
    )
    assert passing == ()

    flush = check_br_rug_landing_strip((0, required, required), SPATIAL, "inst_rug")
    assert flush != ()
    assert "critical aesthetic error" in flush[0].message.lower()


# ---------------------------------------------------------------------------
# Ensuite / closet path (reachability)
# ---------------------------------------------------------------------------


def test_ensuite_closet_path_reachability_42in_36in_pinched_corridor_fails() -> None:
    room = _room(width_in=200, depth_in=100, category=HomeCategory.LARGE)
    bed_point = Point(_mm(10), _mm(10))
    ensuite_point = Point(_mm(190), _mm(10))
    closet_point = Point(_mm(190), _mm(90))

    open_path = check_br_ensuite_path(
        (), room, bed_point, ensuite_point, SPATIAL, "inst_bed"
    )
    assert open_path == ()

    open_closet_path = check_br_closet_path(
        (), room, bed_point, closet_point, SPATIAL, "inst_bed"
    )
    assert open_closet_path == ()

    # A wall-like obstruction spanning the full depth pinches the corridor to
    # nothing wider than a sliver -- reachability must fail.
    pinch_product = _product("prod_wall", width_in=4, depth_in=100)
    pinch = _placement("inst_wall", pinch_product, x_in=100, y_in=0)
    pinched = check_br_ensuite_path(
        (pinch,), room, bed_point, ensuite_point, SPATIAL, "inst_bed"
    )
    assert pinched != ()
    assert pinched[0].rule_id == "BR_ENSUITE_PATH"


# ---------------------------------------------------------------------------
# Credenza proportion
# ---------------------------------------------------------------------------


def test_credenza_proportion_075_passes_074_fails() -> None:
    table_length_mm = 2000
    passing = check_dr_credenza_proportion(
        round(0.75 * table_length_mm), table_length_mm, SPATIAL, "inst_credenza"
    )
    assert passing == ()

    failing = check_dr_credenza_proportion(
        round(0.74 * table_length_mm), table_length_mm, SPATIAL, "inst_credenza"
    )
    assert failing != ()
    assert failing[0].rule_id == "DR_CREDENZA_PROPORTION"


# ---------------------------------------------------------------------------
# Dining pull-back / credenza buffer / sightline (additional coverage)
# ---------------------------------------------------------------------------


def test_dr_pull_back_respects_walkway_behind_flag() -> None:
    assert check_dr_pull_back(
        SPATIAL.dr_pull_back_min_mm, False, SPATIAL, "inst_chair"
    ) == ()
    assert check_dr_pull_back(
        SPATIAL.dr_pull_back_min_mm - 1, False, SPATIAL, "inst_chair"
    ) != ()
    assert check_dr_pull_back(
        SPATIAL.dr_pull_back_with_walkway_mm - 1, True, SPATIAL, "inst_chair"
    ) != ()
    assert check_dr_pull_back(
        SPATIAL.dr_pull_back_with_walkway_mm, True, SPATIAL, "inst_chair"
    ) == ()


def test_dr_credenza_buffer_boundary() -> None:
    required = SPATIAL.dr_credenza_buffer_min_mm
    assert check_dr_credenza_buffer(required, SPATIAL, "inst_credenza") == ()
    failing = check_dr_credenza_buffer(required - 1, SPATIAL, "inst_credenza")
    assert failing != ()
    assert failing[0].rule_id == "DR_CREDENZA_BUFFER"


def test_sightline_12in_requires_table_height_for_tall_opaque_items() -> None:
    threshold = SPATIAL.sightline_12in_threshold_mm
    # Short items are exempt regardless of elevation.
    assert check_sightline_12in(threshold, 0, 750, SPATIAL, "inst_item") == ()
    # Tall item at table height passes.
    assert check_sightline_12in(threshold + 1, 750, 750, SPATIAL, "inst_item") == ()
    # Tall item not at table height fails.
    failing = check_sightline_12in(threshold + 1, 0, 750, SPATIAL, "inst_item")
    assert failing != ()
    assert failing[0].rule_id == "SIGHTLINE_12IN"


# ---------------------------------------------------------------------------
# CMR blocked
# ---------------------------------------------------------------------------


def test_cmr_validation_returns_needs_input_citing_oq_001_never_passes() -> None:
    result = check_cmr_validation("room_test")

    assert len(result) == 1
    violation = result[0]
    assert violation.severity is Severity.NEEDS_INPUT
    assert violation.open_question_id == "OQ-001"
    assert violation.rule_id == "CMR_VALIDATION"


# ---------------------------------------------------------------------------
# Traceability
# ---------------------------------------------------------------------------


def test_every_violation_carries_a_non_empty_source_section() -> None:
    known_sections = {
        "9.2.2.1",
        "9.2.2.2",
        "9.2.2.3",
        "9.4.1",
        "9.4.4",
        "9.3.1",
        "9.3.2",
        "1.11",
        "9 implementation note, 10 STEP 5",
        "Section 9 implementation note",
        "9.1",
    }
    product = _product("prod_a", width_in=40, depth_in=30)
    a = _placement("inst_a", product, x_in=0, y_in=0)
    b = _placement("inst_b", product, x_in=10, y_in=0)

    all_violations = (
        check_collisions((a, b))
        + check_lr_rug_front_leg((0,), HomeCategory.MID, SPATIAL, "x")
        + check_lr_media_sightline(0, SPATIAL, "x")
        + check_lr_floating_anchor(_mm(17 * 12), 0, SPATIAL, "x")
        + check_br_twin_nightstand(HomeCategory.MID, ("a", "b"), SPATIAL, ("x", "y"))
        + check_br_rug_landing_strip((0, 0, 0), SPATIAL, "x")
        + check_dr_credenza_proportion(0, 2000, SPATIAL, "x")
        + check_cmr_validation("x")
    )

    assert all_violations
    for violation in all_violations:
        assert violation.source_section.strip()
        assert violation.source_section in known_sections
