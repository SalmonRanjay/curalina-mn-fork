from dataclasses import FrozenInstanceError
from decimal import Decimal

import pytest
from fixtures.contracts import (
    sample_blocked_result,
    sample_color,
    sample_placement,
    sample_profile,
    sample_rule_metadata,
    sample_rule_result,
    sample_ruleset,
    sample_validated_layout,
)

from curalina_design_rules.pipeline import StyledRoom
from curalina_design_rules.types import (
    HomeCategoryRules,
    LightingPlan,
    MaterialAssignment,
    Money,
    Palette,
    Product,
    ProductAttributes,
    ProductCategory,
    RuleMetadata,
    RuleStatus,
    Severity,
    Violation,
)


def test_rule_result_passes_without_hard_or_needs_input_violations() -> None:
    assert sample_rule_result().passes_hard is True


def test_needs_input_violation_blocks_hard_pass() -> None:
    result = sample_blocked_result()

    assert result.passes_hard is False
    assert result.violations[0].severity is Severity.NEEDS_INPUT
    assert result.violations[0].open_question_id == "OQ-001"


def test_contract_types_are_frozen() -> None:
    profile = sample_profile()

    with pytest.raises(FrozenInstanceError):
        profile.tonality = "dark_moody"  # type: ignore[misc]


def test_product_placement_exposes_stable_ids() -> None:
    placement = sample_placement()

    assert placement.instance_id == "inst_sofa_001"
    assert placement.product_id == "prod_sofa_001"
    assert placement.instance.product.width_mm == 2134


def test_ruleset_carries_version_and_blocked_rule_ids() -> None:
    ruleset = sample_ruleset()

    assert ruleset.rules_version == "rules-0.0.0"
    assert ruleset.metadata[0].rule_id == "CMR_VALIDATION"
    assert ruleset.metadata[0].open_question_id == "OQ-001"


def test_rule_metadata_requires_source_citation() -> None:
    metadata = sample_rule_metadata()

    assert metadata.source_section == "9 implementation note, 10 STEP 5"


def test_needs_input_violation_requires_open_question_id() -> None:
    with pytest.raises(ValueError, match="open_question_id"):
        Violation(
            rule_id="CMR_VALIDATION",
            severity=Severity.NEEDS_INPUT,
            message="blocked",
            source_section="9 implementation note",
            subject_ids=("room_001",),
        )


def test_blocked_rule_metadata_requires_source_and_open_question() -> None:
    with pytest.raises(ValueError, match="source_section"):
        RuleMetadata(
            rule_id="CMR_VALIDATION",
            source_section="   ",
            rules_version="rules-0.0.0",
            status=RuleStatus.BLOCKED,
            open_question_id="OQ-001",
        )

    with pytest.raises(ValueError, match="open_question_id"):
        RuleMetadata(
            rule_id="CMR_VALIDATION",
            source_section="9 implementation note",
            rules_version="rules-0.0.0",
            status=RuleStatus.BLOCKED,
        )


def test_money_requires_decimal_amount() -> None:
    with pytest.raises(TypeError, match="decimal.Decimal"):
        Money(amount=1.23, currency="CAD")  # type: ignore[arg-type]

    assert Money(amount=Decimal("1.23"), currency="CAD").amount == Decimal("1.23")


def test_dimensions_require_integer_millimetres() -> None:
    with pytest.raises(TypeError, match="integer"):
        Product(
            product_id="prod_bad",
            name="Bad Sofa",
            category=ProductCategory.SOFA,
            width_mm=1.5,  # type: ignore[arg-type]
            depth_mm=914,
            height_mm=787,
            price=None,
            attributes=ProductAttributes(),
        )

    with pytest.raises(TypeError, match="integer"):
        HomeCategoryRules(
            category="condo",
            min_walkway_mm=1.5,  # type: ignore[arg-type]
        )


def test_styled_room_requires_validated_layout_contract() -> None:
    layout = sample_validated_layout()
    color = sample_color()
    styled = StyledRoom(
        layout=layout,
        palette=Palette(
            foundation=color,
            accent=color,
            metal="warm_brass",
            high_luster=False,
            seed=7,
        ),
        material_assignment=MaterialAssignment(
            assignments=(("inst_sofa_001", "comfort"),),
        ),
        lighting_plan=LightingPlan(notes=("ambient",)),
    )

    assert styled.layout.spatial_result.passes_hard is True
