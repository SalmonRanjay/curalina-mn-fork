import pytest

from curalina_design_rules import load_rules
from curalina_design_rules.types import RuleStatus


def test_load_rules_uses_packaged_yaml_resources() -> None:
    rules = load_rules()

    assert rules.rules_version == "2026.09.12-a"
    assert {style.style_code for style in rules.styles} == {"OM", "MS", "CL"}
    assert {category.category for category in rules.home_categories} == {
        "condo",
        "mid",
        "large",
    }


def test_load_rules_accepts_known_version() -> None:
    assert load_rules("2026.09.12-a").rules_version == "2026.09.12-a"


def test_load_rules_rejects_unknown_version() -> None:
    with pytest.raises(ValueError, match="unknown rules_version"):
        load_rules("1900.01.01-missing")


def test_home_category_walkways_are_converted_to_integer_mm() -> None:
    categories = {item.category: item for item in load_rules().home_categories}

    assert categories["condo"].min_walkway_mm == 813
    assert categories["mid"].min_walkway_mm == 914
    assert categories["large"].min_walkway_mm == 1219


def test_style_hsl_caps_are_loaded_from_constitution() -> None:
    styles = {item.style_code: item for item in load_rules().styles}

    assert styles["OM"].hsl_caps.saturation_max_pct == 15
    assert styles["OM"].hsl_caps.lightness_range_pct == (40, 92)
    assert styles["OM"].hsl_caps.hue_range_deg == (25, 55)
    assert styles["MS"].hsl_caps.hue_range_deg is None


def test_open_questions_are_loaded_as_blocked_metadata() -> None:
    metadata = load_rules().metadata_by_rule_id()

    assert metadata["CMR_VALIDATION"].status is RuleStatus.BLOCKED
    assert metadata["CMR_VALIDATION"].open_question_id == "OQ-001"
    assert metadata["OM_EDGE_70_30"].status is RuleStatus.BLOCKED
    assert metadata["OM_EDGE_70_30"].open_question_id == "OQ-002"
    assert metadata["MS_VISUAL_LIGHTNESS_80"].open_question_id == "OQ-003"
    assert metadata["CL_SPARK_RULE"].open_question_id == "OQ-006"
    assert metadata["LR_RUG_FRONT_LEG"].status is RuleStatus.ACTIVE
