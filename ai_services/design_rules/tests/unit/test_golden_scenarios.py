"""RULES-A3-01: golden-scenario fixture set.

See `tests/fixtures/golden_scenarios.py` for why these are labelled
"representative" rather than the Design Manual's literal §8 examples: that
section's text is not present anywhere in this repository.
"""

from fixtures.golden_scenarios import ALL_SCENARIOS

from curalina_design_rules import load_rules
from curalina_design_rules.spatial import (
    check_br_ensuite_path,
    check_collisions,
    check_lr_floating_anchor,
)
from curalina_design_rules.types import Point

RULES = load_rules()


def test_every_golden_scenario_is_collision_free() -> None:
    for scenario in ALL_SCENARIOS:
        assert check_collisions(scenario.placements) == (), scenario.scenario_id


def test_condo_living_room_conversation_circle_has_no_floating_anchor_issue() -> None:
    scenario = ALL_SCENARIOS[0]
    room_width_mm = scenario.room.boundary[1].x_mm - scenario.room.boundary[0].x_mm
    sofa_placement = scenario.placements[0]
    assert (
        check_lr_floating_anchor(
            room_width_mm, sofa_placement.y_mm, RULES.spatial_rule_table, "inst_sofa"
        )
        == ()
    )


def test_large_living_room_floating_anchor_violation_fires() -> None:
    scenario = ALL_SCENARIOS[2]
    assert scenario.expect_passes_hard_spatial is False
    room_width_mm = scenario.room.boundary[1].x_mm - scenario.room.boundary[0].x_mm
    sofa_placement = scenario.placements[0]
    violations = check_lr_floating_anchor(
        room_width_mm, sofa_placement.y_mm, RULES.spatial_rule_table, "inst_sofa"
    )
    assert violations != ()
    assert violations[0].rule_id == "LR_FLOATING_ANCHOR"


def test_condo_bedroom_pinched_ensuite_path_fails_reachability() -> None:
    scenario = ALL_SCENARIOS[3]
    bed_point = Point(10, 10)
    ensuite_point = Point(scenario.room.boundary[1].x_mm - 10, 10)

    violations = check_br_ensuite_path(
        scenario.placements,
        scenario.room,
        bed_point,
        ensuite_point,
        RULES.spatial_rule_table,
        "inst_bed",
    )

    assert violations != ()
    assert violations[0].rule_id == "BR_ENSUITE_PATH"


def test_golden_scenarios_cover_all_three_home_categories() -> None:
    categories = {scenario.room.home_category for scenario in ALL_SCENARIOS}
    assert len(categories) == 3
