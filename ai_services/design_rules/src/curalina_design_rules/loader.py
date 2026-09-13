from importlib.resources import files

import yaml

from curalina_design_rules.constitution import load_style_metadata, load_style_rules
from curalina_design_rules.spatial import (
    load_home_category_rules,
    load_spatial_metadata,
    load_spatial_rule_table,
)
from curalina_design_rules.types import RuleSet

RULES_PACKAGE = "curalina_design_rules.rules"
YamlMapping = dict[str, object]


def load_rules(version: str | None = None) -> RuleSet:
    style_doc = _load_yaml_resource("style_constitution.yaml")
    spatial_doc = _load_yaml_resource("spatial_rules.yaml")

    rules_version = _shared_rules_version(style_doc, spatial_doc)
    if version is not None and version != rules_version:
        raise ValueError(f"unknown rules_version: {version}")
    metadata = (
        load_style_metadata(style_doc, rules_version)
        + load_spatial_metadata(spatial_doc, rules_version)
    )

    return RuleSet(
        rules_version=rules_version,
        styles=load_style_rules(style_doc),
        home_categories=load_home_category_rules(spatial_doc),
        metadata=metadata,
        spatial_rule_table=load_spatial_rule_table(spatial_doc, rules_version),
    )


def _load_yaml_resource(resource_name: str) -> YamlMapping:
    resource = files(RULES_PACKAGE).joinpath(resource_name)
    loaded = yaml.safe_load(resource.read_text(encoding="utf-8"))
    if not isinstance(loaded, dict):
        raise ValueError(f"{resource_name} must contain a YAML mapping")
    return loaded


def _shared_rules_version(style_doc: YamlMapping, spatial_doc: YamlMapping) -> str:
    style_version = _required_str(style_doc, "rules_version")
    spatial_version = _required_str(spatial_doc, "rules_version")
    if style_version != spatial_version:
        raise ValueError("style and spatial rules_version values differ")
    return style_version


def _required_str(node: YamlMapping, key: str) -> str:
    value = node.get(key)
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"{key} is required")
    return value
