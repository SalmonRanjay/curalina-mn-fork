"""Deterministic Curalina design-rules package."""

from curalina_design_rules.api import evaluate_spatial_layout, pinned_rules_version
from curalina_design_rules.loader import load_rules

__version__ = "0.0.0"

__all__ = [
    "__version__",
    "evaluate_spatial_layout",
    "load_rules",
    "pinned_rules_version",
]
