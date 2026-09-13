from curalina_design_rules.types import (
    HomeCategoryRules,
    RuleMetadata,
    RuleStatus,
    SpatialRuleTable,
    StyleSpacingRule,
)

INCH_TO_MM = 25.4
FT_TO_MM = 304.8
OPEN_QUESTION_BY_RULE_ID = {
    "CMR_VALIDATION": "OQ-001",
}
YamlMapping = dict[str, object]


def load_home_category_rules(spatial_doc: YamlMapping) -> tuple[HomeCategoryRules, ...]:
    categories = _required_mapping(spatial_doc, "home_categories")
    out: list[HomeCategoryRules] = []
    for category, category_data in categories.items():
        if not isinstance(category_data, dict):
            raise ValueError("home category entries must be mappings")
        out.append(
            HomeCategoryRules(
                category=str(category),
                min_walkway_mm=_inches_to_mm(
                    _required_int(category_data, "min_walkway_in")
                ),
            )
        )
    return tuple(out)


def load_spatial_metadata(
    spatial_doc: YamlMapping,
    rules_version: str,
) -> tuple[RuleMetadata, ...]:
    metadata = [
        _metadata_from_rule(rule, rules_version)
        for rule in _walk_rule_mappings(spatial_doc)
    ]
    metadata.append(
        RuleMetadata(
            rule_id="CMR_VALIDATION",
            source_section="agentic_flow/open_questions.yaml",
            rules_version=rules_version,
            status=RuleStatus.BLOCKED,
            open_question_id="OQ-001",
        )
    )
    return tuple(metadata)


def _metadata_from_rule(
    rule: YamlMapping,
    rules_version: str,
) -> RuleMetadata:
    rule_id = _required_str(rule, "id")
    open_question_id = OPEN_QUESTION_BY_RULE_ID.get(rule_id)
    return RuleMetadata(
        rule_id=rule_id,
        source_section=_required_str(rule, "source"),
        rules_version=rules_version,
        status=RuleStatus.BLOCKED if open_question_id else RuleStatus.ACTIVE,
        open_question_id=open_question_id,
    )


def _walk_rule_mappings(node: object) -> tuple[YamlMapping, ...]:
    out: list[YamlMapping] = []
    if isinstance(node, dict):
        if isinstance(node.get("id"), str) and isinstance(node.get("source"), str):
            out.append(node)
        for value in node.values():
            out.extend(_walk_rule_mappings(value))
    elif isinstance(node, list):
        for value in node:
            out.extend(_walk_rule_mappings(value))
    return tuple(out)


def _required_mapping(node: YamlMapping, key: str) -> YamlMapping:
    value = node.get(key)
    if not isinstance(value, dict):
        raise ValueError(f"{key} is required")
    return value


def _required_str(node: YamlMapping, key: str) -> str:
    value = node.get(key)
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"{key} is required")
    return value


def _required_int(node: YamlMapping, key: str) -> int:
    value = node.get(key)
    if not isinstance(value, int) or isinstance(value, bool):
        raise TypeError(f"{key} must be an integer")
    return value


def _inches_to_mm(value: float) -> int:
    return round(value * INCH_TO_MM)


def load_spatial_rule_table(
    spatial_doc: YamlMapping,
    rules_version: str,
) -> SpatialRuleTable:
    """Parse the §9 named-rule thresholds into integer-millimetre values.

    Every value below is read straight from ``spatial_rules.yaml`` — nothing
    is invented. See the inline comments for the exact YAML path each field
    comes from.
    """
    living = _required_mapping(spatial_doc, "living_room")
    dining = _required_mapping(spatial_doc, "dining_room")
    bedroom = _required_mapping(spatial_doc, "primary_bedroom")
    invariants = _required_list(spatial_doc, "invariants")

    # living_room.sofa_to_table_in — 9.2.1, style-weighted
    sofa_to_table_doc = _required_mapping(living, "sofa_to_table_in")
    sofa_to_table = tuple(
        StyleSpacingRule(
            style_code=str(style_code),
            min_mm=_inches_to_mm(_number_at(bounds, 0)),
            max_mm=_inches_to_mm(_number_at(bounds, 1)),
        )
        for style_code, bounds in sofa_to_table_doc.items()
    )

    guardrails = {
        _required_str(entry, "id"): entry
        for entry in _required_list(living, "hard_guardrails")
    }
    rug_front_leg = guardrails["LR_RUG_FRONT_LEG"]  # 9.2.2.1
    media_sightline = guardrails["LR_MEDIA_SIGHTLINE"]  # 9.2.2.2
    floating_anchor = guardrails["LR_FLOATING_ANCHOR"]  # 9.2.2.3

    symmetry = {
        _required_str(entry, "id"): entry
        for entry in _required_list(bedroom, "symmetry")
    }
    twin_nightstand = symmetry["BR_TWIN_NIGHTSTAND"]  # 9.4.1

    rug_rules = {
        _required_str(entry, "id"): entry for entry in _required_list(bedroom, "rug")
    }
    rug_landing_strip = rug_rules["BR_RUG_LANDING_STRIP"]  # 9.4.1

    suite_circulation = {
        _required_str(entry, "id"): entry
        for entry in _required_list(bedroom, "suite_circulation")
    }
    ensuite_path = suite_circulation["BR_ENSUITE_PATH"]  # 9.4.4
    closet_path = suite_circulation["BR_CLOSET_PATH"]  # 9.4.4

    clearances = _required_mapping(dining, "clearances")  # 9.3.1
    perimeter_accents = _required_mapping(dining, "perimeter_accents")
    gallery_buffer = next(
        entry
        for entry in _required_list(perimeter_accents, "require")
        if _required_str(entry, "id") == "gallery_buffer"
    )

    sightline_12in = next(
        entry for entry in invariants if _required_str(entry, "id") == "SIGHTLINE_12IN"
    )

    return SpatialRuleTable(
        rules_version=rules_version,
        sofa_to_table_mm=sofa_to_table,
        rug_front_leg_min_mm=_inches_to_mm(
            _number(rug_front_leg, "min_front_leg_on_rug_in")
        ),
        media_sightline_center_mm=_inches_to_mm(
            _number(media_sightline, "tv_center_aff_in")
        ),
        floating_anchor_room_width_threshold_mm=round(
            _number(floating_anchor, "when_room_width_gt_ft") * FT_TO_MM
        ),
        floating_anchor_min_clearance_mm=_inches_to_mm(
            _number(floating_anchor, "min_behind_sofa_circulation_in")
        ),
        twin_nightstand_categories=tuple(
            _required_str_list(twin_nightstand, "applies_to_category")
        ),
        rug_landing_strip_min_mm=_inches_to_mm(
            _number(rug_landing_strip, "min_extension_beyond_bed_in")
        ),
        ensuite_path_min_mm=_inches_to_mm(_number(ensuite_path, "min_clear_path_in")),
        closet_path_min_mm=_inches_to_mm(_number(closet_path, "min_clear_path_in")),
        dr_pull_back_min_mm=_inches_to_mm(_number(clearances, "pull_back_zone_in")),
        dr_pull_back_with_walkway_mm=_inches_to_mm(
            _number(clearances, "pull_back_with_walkway_behind_in")
        ),
        dr_credenza_buffer_min_mm=_inches_to_mm(
            _number(clearances, "credenza_buffer_in")
        ),
        dr_credenza_min_fraction=_number(
            gallery_buffer, "credenza_min_fraction_of_table_length"
        ),
        sightline_12in_threshold_mm=_inches_to_mm(
            _number(sightline_12in, "threshold_in")
        ),
    )


def _required_list(node: YamlMapping, key: str) -> list[YamlMapping]:
    value = node.get(key)
    if not isinstance(value, list) or not all(isinstance(item, dict) for item in value):
        raise ValueError(f"{key} must be a list of mappings")
    return value


def _required_str_list(node: YamlMapping, key: str) -> list[str]:
    value = node.get(key)
    if not isinstance(value, list) or not all(isinstance(item, str) for item in value):
        raise ValueError(f"{key} must be a list of strings")
    return value


def _number(node: YamlMapping, key: str) -> float:
    value = node.get(key)
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise TypeError(f"{key} must be numeric")
    return float(value)


def _number_at(values: object, index: int) -> float:
    if not isinstance(values, list) or len(values) <= index:
        raise ValueError("expected an indexable numeric list")
    item = values[index]
    if isinstance(item, bool) or not isinstance(item, (int, float)):
        raise TypeError("list item must be numeric")
    return float(item)
