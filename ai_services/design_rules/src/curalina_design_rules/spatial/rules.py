"""§9 named spatial rules.

Each function returns `tuple[Violation, ...]` — empty means the rule passed.
Every violation traces to a `source_section` that exists in
`rules/spatial_rules.yaml`. `CMR_VALIDATION` is genuinely blocked: the manual
requires it (9 implementation note, 10 STEP 5) but never supplies a formula
(OQ-001), so it always returns `needs_input` — never a guessed pass or fail.
"""

from curalina_design_rules.spatial.geometry import check_reachability
from curalina_design_rules.types import (
    HomeCategory,
    Placement,
    Point,
    RoomGeometry,
    Severity,
    SpatialRuleTable,
    Violation,
)

_CMR_OPEN_QUESTION_ID = "OQ-001"


def check_lr_rug_front_leg(
    front_leg_insets_mm: tuple[int, ...],
    home_category: HomeCategory,
    rules: SpatialRuleTable,
    subject_id: str,
) -> tuple[Violation, ...]:
    """9.2.2.1 — all front legs >= 8" onto the rug; LARGE demands all legs on."""
    required = rules.rug_front_leg_min_mm
    min_inset = min(front_leg_insets_mm)
    all_legs_on = all(inset >= required for inset in front_leg_insets_mm)
    fails_large_override = home_category is HomeCategory.LARGE and not all_legs_on
    if min_inset < required or fails_large_override:
        return (
            Violation(
                rule_id="LR_RUG_FRONT_LEG",
                severity=Severity.HARD,
                message=(
                    f"Front-leg rug inset {min_inset}mm is below the required "
                    f"{required}mm"
                    + (
                        " (large category requires all legs on)"
                        if fails_large_override
                        else ""
                    )
                ),
                source_section="9.2.2.1",
                subject_ids=(subject_id,),
                measured=float(min_inset),
                required=float(required),
            ),
        )
    return ()


def check_lr_media_sightline(
    tv_center_aff_mm: int,
    rules: SpatialRuleTable,
    subject_id: str,
) -> tuple[Violation, ...]:
    """9.2.2.2 — TV centre must be exactly 1067mm (42") AFF, not a range."""
    required = rules.media_sightline_center_mm
    if tv_center_aff_mm != required:
        return (
            Violation(
                rule_id="LR_MEDIA_SIGHTLINE",
                severity=Severity.HARD,
                message=(
                    f"TV centre {tv_center_aff_mm}mm AFF must equal "
                    f"{required}mm exactly"
                ),
                source_section="9.2.2.2",
                subject_ids=(subject_id,),
                measured=float(tv_center_aff_mm),
                required=float(required),
            ),
        )
    return ()


def check_lr_floating_anchor(
    room_width_mm: int,
    sofa_distance_from_wall_mm: int,
    rules: SpatialRuleTable,
    subject_id: str,
) -> tuple[Violation, ...]:
    """9.2.2.3 — rooms wider than 16ft: sofa must float, >=30" off the wall."""
    if room_width_mm <= rules.floating_anchor_room_width_threshold_mm:
        return ()
    required = rules.floating_anchor_min_clearance_mm
    if sofa_distance_from_wall_mm < required:
        return (
            Violation(
                rule_id="LR_FLOATING_ANCHOR",
                severity=Severity.HARD,
                message=(
                    f"Sofa is {sofa_distance_from_wall_mm}mm off the wall; "
                    f"rooms over the width threshold require >= {required}mm"
                ),
                source_section="9.2.2.3",
                subject_ids=(subject_id,),
                measured=float(sofa_distance_from_wall_mm),
                required=float(required),
            ),
        )
    return ()


def check_br_twin_nightstand(
    home_category: HomeCategory,
    nightstand_product_ids: tuple[str, str],
    rules: SpatialRuleTable,
    subject_ids: tuple[str, str],
) -> tuple[Violation, ...]:
    """9.4.1 — mid/large bedrooms require a matched nightstand pair."""
    if home_category.value not in rules.twin_nightstand_categories:
        return ()
    if nightstand_product_ids[0] != nightstand_product_ids[1]:
        return (
            Violation(
                rule_id="BR_TWIN_NIGHTSTAND",
                severity=Severity.HARD,
                message=(
                    "Nightstands must be a matched pair (same product) "
                    "in mid/large homes"
                ),
                source_section="9.4.1",
                subject_ids=subject_ids,
            ),
        )
    return ()


def check_br_rug_landing_strip(
    extensions_mm: tuple[int, int, int],
    rules: SpatialRuleTable,
    subject_id: str,
) -> tuple[Violation, ...]:
    """9.4.1 — rug must extend >= 24" past both bed sides and the foot."""
    required = rules.rug_landing_strip_min_mm
    min_extension = min(extensions_mm)
    if min_extension < required:
        is_flush = min_extension <= 0
        return (
            Violation(
                rule_id="BR_RUG_LANDING_STRIP",
                severity=Severity.HARD,
                message=(
                    "Rug ends at the bed frame — critical aesthetic error"
                    if is_flush
                    else (
                        f"Rug landing strip {min_extension}mm is below "
                        f"required {required}mm"
                    )
                ),
                source_section="9.4.1",
                subject_ids=(subject_id,),
                measured=float(min_extension),
                required=float(required),
            ),
        )
    return ()


def check_br_ensuite_path(
    placements: tuple[Placement, ...],
    room: RoomGeometry,
    bed_point: Point,
    ensuite_door_point: Point,
    rules: SpatialRuleTable,
    subject_id: str,
) -> tuple[Violation, ...]:
    """9.4.4 — bed to ensuite door requires a >=42" clear path."""
    required = rules.ensuite_path_min_mm
    if check_reachability(placements, room, bed_point, ensuite_door_point, required):
        return ()
    return (
        Violation(
            rule_id="BR_ENSUITE_PATH",
            severity=Severity.HARD,
            message=f"No continuous {required}mm path from bed to ensuite door",
            source_section="9.4.4",
            subject_ids=(subject_id,),
            required=float(required),
        ),
    )


def check_br_closet_path(
    placements: tuple[Placement, ...],
    room: RoomGeometry,
    bed_point: Point,
    closet_point: Point,
    rules: SpatialRuleTable,
    subject_id: str,
) -> tuple[Violation, ...]:
    """9.4.4 — bed to walk-in closet requires a >=36" clear path."""
    required = rules.closet_path_min_mm
    if check_reachability(placements, room, bed_point, closet_point, required):
        return ()
    return (
        Violation(
            rule_id="BR_CLOSET_PATH",
            severity=Severity.HARD,
            message=f"No continuous {required}mm path from bed to closet",
            source_section="9.4.4",
            subject_ids=(subject_id,),
            required=float(required),
        ),
    )


def check_dr_pull_back(
    clear_behind_mm: int,
    has_walkway_behind: bool,
    rules: SpatialRuleTable,
    subject_id: str,
) -> tuple[Violation, ...]:
    """9.3.1 — 36" chair pull-back, or 44" if a walkway runs behind it."""
    required = (
        rules.dr_pull_back_with_walkway_mm
        if has_walkway_behind
        else rules.dr_pull_back_min_mm
    )
    if clear_behind_mm < required:
        return (
            Violation(
                rule_id="DR_PULL_BACK",
                severity=Severity.HARD,
                message=(
                    f"Chair pull-back {clear_behind_mm}mm is below "
                    f"required {required}mm"
                ),
                source_section="9.3.1",
                subject_ids=(subject_id,),
                measured=float(clear_behind_mm),
                required=float(required),
            ),
        )
    return ()


def check_dr_credenza_buffer(
    table_to_credenza_mm: int,
    rules: SpatialRuleTable,
    subject_id: str,
) -> tuple[Violation, ...]:
    """9.3.1 — >=48" from table edge to credenza."""
    required = rules.dr_credenza_buffer_min_mm
    if table_to_credenza_mm < required:
        return (
            Violation(
                rule_id="DR_CREDENZA_BUFFER",
                severity=Severity.HARD,
                message=(
                    f"Table-to-credenza buffer {table_to_credenza_mm}mm "
                    f"below {required}mm"
                ),
                source_section="9.3.1",
                subject_ids=(subject_id,),
                measured=float(table_to_credenza_mm),
                required=float(required),
            ),
        )
    return ()


def check_dr_credenza_proportion(
    credenza_length_mm: int,
    table_length_mm: int,
    rules: SpatialRuleTable,
    subject_id: str,
) -> tuple[Violation, ...]:
    """9.3.2 — credenza length must be >= 0.75x the table length."""
    required_fraction = rules.dr_credenza_min_fraction
    required_mm = required_fraction * table_length_mm
    if credenza_length_mm < required_mm:
        return (
            Violation(
                rule_id="DR_CREDENZA_PROPORTION",
                severity=Severity.HARD,
                message=(
                    f"Credenza {credenza_length_mm}mm is below "
                    f"{required_fraction:.0%} of table length ({required_mm:.0f}mm)"
                ),
                source_section="9.3.2",
                subject_ids=(subject_id,),
                measured=float(credenza_length_mm),
                required=required_mm,
            ),
        )
    return ()


def check_sightline_12in(
    item_height_mm: int,
    item_elevation_mm: int,
    table_height_mm: int,
    rules: SpatialRuleTable,
    subject_id: str,
) -> tuple[Violation, ...]:
    """1.11 — an opaque object over 12" tall must sit at table height."""
    if item_height_mm <= rules.sightline_12in_threshold_mm:
        return ()
    if item_elevation_mm != table_height_mm:
        return (
            Violation(
                rule_id="SIGHTLINE_12IN",
                severity=Severity.HARD,
                message=(
                    f"Opaque item over {rules.sightline_12in_threshold_mm}mm tall "
                    "must sit at table height"
                ),
                source_section="1.11",
                subject_ids=(subject_id,),
                measured=float(item_elevation_mm),
                required=float(table_height_mm),
            ),
        )
    return ()


def check_cmr_validation(subject_id: str) -> tuple[Violation, ...]:
    """CMR_VALIDATION is blocked on OQ-001 — the manual never defines the
    Circulation-to-Mass Ratio formula or its pass band. This always returns
    `needs_input`; it never guesses a formula and never silently passes.
    """
    return (
        Violation(
            rule_id="CMR_VALIDATION",
            severity=Severity.NEEDS_INPUT,
            message=(
                "Circulation-to-Mass Ratio formula is undefined in the Design "
                "Manual (Section 9 implementation note, Section 10 STEP 5); "
                "cannot evaluate until the design authority resolves OQ-001."
            ),
            source_section="9 implementation note, 10 STEP 5",
            subject_ids=(subject_id,),
            open_question_id=_CMR_OPEN_QUESTION_ID,
        ),
    )
