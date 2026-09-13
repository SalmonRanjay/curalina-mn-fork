"""Spatial and clearance rule contracts, loaders, and evaluation engine."""

from curalina_design_rules.spatial.geometry import (
    check_collisions,
    check_reachability,
    check_walkways,
    footprint,
    has_walkway,
    room_polygon,
)
from curalina_design_rules.spatial.loader import (
    load_home_category_rules,
    load_spatial_metadata,
    load_spatial_rule_table,
)
from curalina_design_rules.spatial.rules import (
    check_br_closet_path,
    check_br_ensuite_path,
    check_br_rug_landing_strip,
    check_br_twin_nightstand,
    check_cmr_validation,
    check_dr_credenza_buffer,
    check_dr_credenza_proportion,
    check_dr_pull_back,
    check_lr_floating_anchor,
    check_lr_media_sightline,
    check_lr_rug_front_leg,
    check_sightline_12in,
)

__all__ = [
    "check_br_closet_path",
    "check_br_ensuite_path",
    "check_br_rug_landing_strip",
    "check_br_twin_nightstand",
    "check_cmr_validation",
    "check_collisions",
    "check_dr_credenza_buffer",
    "check_dr_credenza_proportion",
    "check_dr_pull_back",
    "check_lr_floating_anchor",
    "check_lr_media_sightline",
    "check_lr_rug_front_leg",
    "check_reachability",
    "check_sightline_12in",
    "check_walkways",
    "footprint",
    "has_walkway",
    "load_home_category_rules",
    "load_spatial_metadata",
    "load_spatial_rule_table",
    "room_polygon",
]
