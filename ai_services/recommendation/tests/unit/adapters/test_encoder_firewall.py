"""ADR-0006 §D2's leakage firewall, asserted mechanically at the encoder
level: none of the three real `FeatureEncoder` adapters may reference a
label-source field name, and `Product` itself carries none of them (the
domain-level half of the firewall is
`tests/unit/domain/test_product.py::test_product_carries_no_label_source_fields`).
"""

from __future__ import annotations

import inspect

from curalina_recommendation.adapters import (
    minilm_encoder,
    rule_only_encoder,
    tfidf_encoder,
)
from curalina_recommendation.domain.product import Product

_LABEL_SOURCE_FIELD_NAMES = (
    "room_type",
    "design_style",
    "tags",
    "attributes",
)

# `Product.<x>` attribute accesses that would read a label-source field, if
# one ever existed on `Product`. Checked as compound strings (not bare
# substrings) so `profile.style`/`profile.room_type` — legitimate Design
# Quiz inputs, unrelated to the catalogue's label-source columns — are not
# false positives.
_FORBIDDEN_PRODUCT_ATTRIBUTE_ACCESSES = tuple(
    f"product.{name}" for name in (*_LABEL_SOURCE_FIELD_NAMES, "style")
)

_ENCODER_MODULES = (rule_only_encoder, tfidf_encoder, minilm_encoder)


def test_product_has_no_label_source_attributes_an_encoder_could_read() -> None:
    field_names = set(Product.__dataclass_fields__)
    assert field_names.isdisjoint(_LABEL_SOURCE_FIELD_NAMES)


def test_no_encoder_module_source_accesses_a_label_source_product_attribute() -> None:
    for module in _ENCODER_MODULES:
        source = inspect.getsource(module)
        for forbidden in _FORBIDDEN_PRODUCT_ATTRIBUTE_ACCESSES:
            assert forbidden not in source, (
                f"{module.__name__} accesses forbidden `{forbidden}` — "
                "ADR-0006 §D2 firewall violation"
            )


def test_encoder_text_helpers_read_only_name_and_overview() -> None:
    # Every real encoder's text-extraction helper must read exactly
    # `name` + `overview` from `Product` — never anything else.
    for module in _ENCODER_MODULES:
        source = inspect.getsource(module._encoder_text)
        assert "product.name" in source
        assert "product.overview" in source
