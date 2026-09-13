from curalina_design_rules.types import HslCaps, RuleMetadata, RuleStatus, StyleRules

OPEN_QUESTION_BY_RULE_ID = {
    "OM_EDGE_70_30": "OQ-002",
    "MS_VISUAL_LIGHTNESS_80": "OQ-003",
    "CL_SPARK_RULE": "OQ-006",
}


YamlMapping = dict[str, object]


def load_style_rules(style_doc: YamlMapping) -> tuple[StyleRules, ...]:
    styles = _required_mapping(style_doc, "styles")
    out: list[StyleRules] = []
    for style_data in styles.values():
        if not isinstance(style_data, dict):
            raise ValueError("style entries must be mappings")
        hsl_caps = _required_mapping(style_data, "hsl_caps")
        out.append(
            StyleRules(
                style_code=_required_str(style_data, "code"),
                hsl_caps=HslCaps(
                    saturation_max_pct=_required_int(hsl_caps, "saturation_max_pct"),
                    lightness_range_pct=_required_int_pair(
                        hsl_caps,
                        "lightness_range_pct",
                    ),
                    hue_range_deg=_optional_int_pair(hsl_caps, "hue_range_deg"),
                ),
            )
        )
    return tuple(out)


def load_style_metadata(
    style_doc: YamlMapping,
    rules_version: str,
) -> tuple[RuleMetadata, ...]:
    return tuple(
        _metadata_from_rule(rule, rules_version)
        for rule in _walk_rule_mappings(style_doc)
    )


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


def _required_int_pair(node: YamlMapping, key: str) -> tuple[int, int]:
    value = node.get(key)
    if (
        not isinstance(value, list)
        or len(value) != 2
        or not all(
            isinstance(item, int) and not isinstance(item, bool) for item in value
        )
    ):
        raise TypeError(f"{key} must be a two-integer list")
    return (value[0], value[1])


def _optional_int_pair(node: YamlMapping, key: str) -> tuple[int, int] | None:
    if key not in node:
        return None
    return _required_int_pair(node, key)
