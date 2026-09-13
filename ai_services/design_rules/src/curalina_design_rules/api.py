"""Stable in-process entry points for `curalina_recommendation` and
`curalina_rooms`.

This is the only module those services should import from directly. Both
call it synchronously (no adapter, no network hop — see
`agentic_flow/12_design_rules_engine.md`, "Why a library, not a service").
Consumers pin an exact `rules_version` (via `pinned_rules_version` /
`load_rules(version=...)`); a version bump here is a breaking-change event
for both consumers.
"""

from curalina_design_rules.loader import load_rules
from curalina_design_rules.spatial import (
    check_cmr_validation,
    check_collisions,
    check_walkways,
)
from curalina_design_rules.types import Placement, RoomGeometry, RuleResult, RuleSet

__all__ = [
    "evaluate_spatial_layout",
    "load_rules",
    "pinned_rules_version",
]


def pinned_rules_version() -> str:
    """The `rules_version` a consumer should record in its bundle manifest.

    Call this once at startup and pass the result to `load_rules(version=...)`
    on every subsequent call so a mid-deployment rules change cannot silently
    change behaviour for an in-flight request.
    """
    return load_rules().rules_version


def evaluate_spatial_layout(
    placements: tuple[Placement, ...],
    room: RoomGeometry,
    rules: RuleSet,
) -> RuleResult:
    """Section 9 / Section 10 STEP 5 entry point: validate a placed layout.

    Aggregates the geometry-driven checks that need only placements + room
    geometry: collision detection (`NO_PLACEMENT_ON_VIOLATION`), the home
    category's minimum-walkway opening test, and `CMR_VALIDATION` (always
    `needs_input`, citing OQ-001 — see `spatial.check_cmr_validation`).

    The named per-rule checks that need additional designer/product inputs
    (rug front-leg inset, TV sightline height, twin-nightstand product IDs,
    credenza proportion, etc.) are NOT bundled here — call the corresponding
    function in `curalina_design_rules.spatial` directly with the specific
    measurements each rule requires. Bundling them here would force this
    entry point to invent inputs it does not have.

    Raises `ValueError` if `rules` was not built with a spatial rule table
    (i.e. not produced by `load_rules`), or if no `home_categories` entry
    matches `room.home_category`.
    """
    if rules.spatial_rule_table is None:
        raise ValueError(
            "RuleSet has no spatial_rule_table; use curalina_design_rules.load_rules() "
            "rather than constructing RuleSet by hand"
        )

    home_category = next(
        (
            category
            for category in rules.home_categories
            if category.category == room.home_category.value
        ),
        None,
    )
    if home_category is None:
        raise ValueError(
            f"no home_category rules loaded for {room.home_category.value!r}"
        )

    violations = (
        check_collisions(placements)
        + check_walkways(placements, room, home_category.min_walkway_mm)
        + check_cmr_validation(room.room_id)
    )
    return RuleResult(violations=violations, rules_version=rules.rules_version)
