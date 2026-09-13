import hashlib
from pathlib import Path

import pytest

from curalina_design_rules import load_rules

PROJECT_ROOT = Path(__file__).resolve().parents[4]
AGENTIC_FLOW = PROJECT_ROOT / "agentic_flow"
PACKAGE_RULES = (
    PROJECT_ROOT
    / "ai_services"
    / "design_rules"
    / "src"
    / "curalina_design_rules"
    / "rules"
)


def test_packaged_yaml_copies_match_authoritative_sources() -> None:
    for filename in ("style_constitution.yaml", "spatial_rules.yaml"):
        assert _sha256(PACKAGE_RULES / filename) == _sha256(AGENTIC_FLOW / filename)


def test_loaded_rule_metadata_has_source_sections() -> None:
    rules = load_rules()

    assert rules.metadata
    assert all(item.source_section.strip() for item in rules.metadata)


@pytest.mark.parametrize(
    ("rule_id", "source_section"),
    (
        ("OM_EDGE_70_30", "1.1"),
        ("MS_VISUAL_LIGHTNESS_80", "1.2"),
        ("CL_PLINTH_BASE", "1.3"),
        ("CL_SPARK_RULE", "3.4.4, 3.5.2"),
        ("ANTI_VIBRANCY_60", "3.4.3"),
        ("MATERIAL_COLOR_INVERSION", "3.4.2"),
        ("METAL_PRIMARY_SECONDARY", "1.x Metal Mixing Rule"),
        ("GATE3_METAL_MATCH", "3.5 Gate 3"),
        ("MATERIAL_BUFFER", "7.4.1"),
        ("WOOD_SPECIES_CONTINUITY", "7.4.2"),
        ("LUSTER_SYNC", "7.4.4"),
        ("NO_MONOLITHIC_FURNITURE", "7.2"),
        ("LR_RUG_FRONT_LEG", "9.2.2.1"),
        ("LR_MEDIA_SIGHTLINE", "9.2.2.2"),
        ("LR_FLOATING_ANCHOR", "9.2.2.3"),
        ("BR_TWIN_NIGHTSTAND", "9.4.1"),
        ("BR_RUG_LANDING_STRIP", "9.4.1"),
        ("BR_ENSUITE_PATH", "9.4.4"),
        ("BR_CLOSET_PATH", "9.4.4"),
        ("BR_NO_CLUTTER_CHECK", "9.4.4"),
        ("LIGHT_3_POINT", "9.6.1"),
        ("LIGHT_SHADOW_CHECK", "9.6.2"),
        ("CL_SHADOW_SCONCE", "9.5"),
        (
            "SPATIAL_TRUE_DIMENSIONS",
            "Section 9 implementation note, Section 10 hard guardrail",
        ),
        (
            "SPATIAL_BEFORE_STYLE",
            "Section 9 implementation note, Section 10 hard guardrail",
        ),
        ("NO_PLACEMENT_ON_VIOLATION", "Section 9 implementation note"),
        ("SIGHTLINE_12IN", "1.11"),
    ),
)
def test_named_yaml_rules_preserve_source_sections(
    rule_id: str,
    source_section: str,
) -> None:
    metadata = load_rules().metadata_by_rule_id()

    assert metadata[rule_id].source_section == source_section


def _sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()
