"""RULES-A2b-02: ADR-0004 interim reading of §9.1 `MIN_WALKWAY`.

See `architecture/adr/ADR-0004-walkway-clearance-interim-interpretation.md`.
`OQ-013` (`agentic_flow/open_questions.yaml`) stays open and owned by
`design_authority` -- these tests prove the *interim* reachability reading
behaves as the ADR specifies, not that OQ-013 is resolved.
"""

from fixtures.golden_scenarios import ALL_SCENARIOS

from curalina_design_rules import load_rules
from curalina_design_rules.spatial import (
    ADR_0004_MARKER,
    check_walkways,
    check_walkways_adr0004,
    has_walkway,
)
from curalina_design_rules.spatial.geometry import _free_area
from curalina_design_rules.types import HomeCategory, Point, Severity

RULES = load_rules()


def _min_walkway_mm(category: HomeCategory) -> int:
    return next(
        c.min_walkway_mm
        for c in RULES.home_categories
        if c.category == category.value
    )


# ---------------------------------------------------------------------------
# 1. The documented reason the interim reading exists: a §9.2.1 furniture
#    gap narrower than the category walkway minimum, but with circulation
#    endpoints still connected around it.
# ---------------------------------------------------------------------------


def test_adr0004_passes_furniture_gap_narrower_than_walkway_when_endpoints_reachable() -> None:  # noqa: E501
    scenario = ALL_SCENARIOS[0]  # condo_living_room_conversation_circle
    min_walkway = _min_walkway_mm(HomeCategory.CONDO)

    # Confirm the documented failure mode first: the literal whole-free-floor
    # reading fails, because the OM sofa-to-table gap (~381mm) is narrower
    # than the condo walkway minimum (813mm) -- this is OQ-013's exact
    # confirmed case, not a contrived one.
    literal = check_walkways(scenario.placements, scenario.room, min_walkway)
    assert literal != ()
    assert literal[0].rule_id == "MIN_WALKWAY"

    # A doorway on the far side of the room and the seating area's
    # functional zone (in front of the coffee table) remain connected
    # through the opened free space by routing around the sofa/table
    # grouping -- the pinch between sofa and table is not on any required
    # circulation path.
    doorway = Point(3800, 1500)
    seating_zone = Point(700, 2300)

    result = check_walkways_adr0004(
        scenario.placements,
        scenario.room,
        min_walkway,
        (doorway,),
        (seating_zone,),
    )

    assert result.passes is True
    assert result.violations == ()
    assert result.interim_marker == ADR_0004_MARKER


def test_adr0004_fails_when_circulation_endpoints_are_genuinely_blocked() -> None:
    scenario = ALL_SCENARIOS[3]  # condo_bedroom_pinched_ensuite_path
    min_walkway = _min_walkway_mm(HomeCategory.CONDO)

    bed_point = Point(254, 254)
    ensuite_point = Point(scenario.room.boundary[1].x_mm - 254, 254)

    # A full-depth wardrobe genuinely pinches the only path between the bed
    # doorway and the ensuite doorway -- there is no way around it, so even
    # the reachability reading must fail this one.
    result = check_walkways_adr0004(
        scenario.placements,
        scenario.room,
        min_walkway,
        (bed_point, ensuite_point),
        (bed_point,),
    )

    assert result.passes is False
    assert len(result.violations) == 1
    violation = result.violations[0]
    assert violation.rule_id == "MIN_WALKWAY"
    assert violation.severity is Severity.HARD
    assert violation.source_section == ADR_0004_MARKER
    assert result.interim_marker == ADR_0004_MARKER


# ---------------------------------------------------------------------------
# 2. Missing circulation-endpoint input must return needs_input citing
#    OQ-013 -- never a guessed/synthesized doorway or zone position.
# ---------------------------------------------------------------------------


def test_adr0004_missing_circulation_endpoints_returns_needs_input_citing_oq_013() -> None:  # noqa: E501
    scenario = ALL_SCENARIOS[0]
    min_walkway = _min_walkway_mm(HomeCategory.CONDO)

    no_doorways = check_walkways_adr0004(
        scenario.placements,
        scenario.room,
        min_walkway,
        (),
        (Point(700, 2300),),
    )
    no_zones = check_walkways_adr0004(
        scenario.placements,
        scenario.room,
        min_walkway,
        (Point(3800, 1500),),
        (),
    )
    neither = check_walkways_adr0004(
        scenario.placements, scenario.room, min_walkway, (), ()
    )

    for result in (no_doorways, no_zones, neither):
        assert result.passes is False
        assert len(result.violations) == 1
        violation = result.violations[0]
        assert violation.rule_id == "MIN_WALKWAY"
        assert violation.severity is Severity.NEEDS_INPUT
        assert violation.open_question_id == "OQ-013"
        assert violation.source_section == ADR_0004_MARKER
        assert result.interim_marker == ADR_0004_MARKER


# ---------------------------------------------------------------------------
# 3. The literal reading (`has_walkway` / `check_walkways`) must be entirely
#    unchanged -- this is the revert path if the design authority rules the
#    other way on OQ-013, and it must still be callable exactly as before.
# ---------------------------------------------------------------------------


def test_has_walkway_literal_reading_unchanged_regression() -> None:
    scenario = ALL_SCENARIOS[0]
    min_walkway = _min_walkway_mm(HomeCategory.CONDO)
    free = _free_area(scenario.placements, scenario.room)

    # Same call shape and same result `has_walkway` had before ADR-0004:
    # the whole-free-floor opening test, still failing on the sofa/table gap.
    assert has_walkway(free, min_walkway) is False

    # check_walkways (the literal MIN_WALKWAY wrapper) is untouched: same
    # signature, same boundary-exact behaviour as the pre-existing
    # test_walkway_boundary_passes_exactly_and_fails_below_for_every_category.
    passing_result = check_walkways((), scenario.room, min_walkway)
    assert passing_result == ()

    failing_result = check_walkways(scenario.placements, scenario.room, min_walkway)
    assert failing_result != ()
    assert failing_result[0].rule_id == "MIN_WALKWAY"
    assert failing_result[0].source_section == "9.1"
