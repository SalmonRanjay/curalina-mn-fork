"""RULES-A3-01: consumer-facing in-process API surface."""

import pytest
from fixtures.golden_scenarios import ALL_SCENARIOS

import curalina_design_rules
from curalina_design_rules import (
    evaluate_spatial_layout,
    load_rules,
    pinned_rules_version,
)
from curalina_design_rules.types import Severity


def test_pinned_rules_version_matches_load_rules() -> None:
    version = pinned_rules_version()
    assert version == load_rules().rules_version
    # Consumers must be able to pin the exact version they saw at startup.
    assert load_rules(version).rules_version == version


def test_package_exports_the_stable_entry_points() -> None:
    assert curalina_design_rules.load_rules is load_rules
    assert curalina_design_rules.evaluate_spatial_layout is evaluate_spatial_layout
    assert curalina_design_rules.pinned_rules_version is pinned_rules_version


def test_evaluate_spatial_layout_rejects_a_ruleset_without_spatial_table() -> None:
    from curalina_design_rules.types import (
        HomeCategoryRules,
        HslCaps,
        RuleSet,
        StyleRules,
    )

    bare_rules = RuleSet(
        rules_version="test",
        styles=(StyleRules(style_code="OM", hsl_caps=HslCaps(15, (40, 92))),),
        home_categories=(HomeCategoryRules(category="condo", min_walkway_mm=813),),
    )
    scenario = ALL_SCENARIOS[0]
    with pytest.raises(ValueError, match="spatial_rule_table"):
        evaluate_spatial_layout(scenario.placements, scenario.room, bare_rules)


def test_evaluate_spatial_layout_rejects_unmapped_home_category() -> None:
    rules = load_rules()
    scenario = ALL_SCENARIOS[0]
    # Every loaded rules version must cover condo/mid/large; simulate the
    # gap by asking for a room whose home_category string isn't in the set.
    stripped_rules = rules.__class__(
        rules_version=rules.rules_version,
        styles=rules.styles,
        home_categories=(),
        metadata=rules.metadata,
        spatial_rule_table=rules.spatial_rule_table,
    )
    with pytest.raises(ValueError, match="no home_category rules"):
        evaluate_spatial_layout(scenario.placements, scenario.room, stripped_rules)


def test_evaluate_spatial_layout_always_surfaces_cmr_needs_input() -> None:
    rules = load_rules()
    for scenario in ALL_SCENARIOS:
        result = evaluate_spatial_layout(scenario.placements, scenario.room, rules)
        cmr = [v for v in result.violations if v.rule_id == "CMR_VALIDATION"]
        assert len(cmr) == 1
        assert cmr[0].severity is Severity.NEEDS_INPUT
        assert cmr[0].open_question_id == "OQ-001"
        # CMR being blocked means passes_hard is never true from this
        # entry point alone until OQ-001 is resolved -- this is intentional,
        # not a bug: needs_input must never be silently treated as a pass.
        assert result.passes_hard is False
