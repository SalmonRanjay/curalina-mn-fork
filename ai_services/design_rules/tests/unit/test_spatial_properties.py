"""RULES-A2b-01 hypothesis property tests."""

from decimal import Decimal

from hypothesis import given, settings
from hypothesis import strategies as st

from curalina_design_rules import load_rules
from curalina_design_rules.spatial import check_collisions
from curalina_design_rules.types import (
    Money,
    Placement,
    Product,
    ProductAttributes,
    ProductCategory,
    ProductInstance,
)

RULES = load_rules()

_dimension = st.integers(min_value=100, max_value=3000)
_position = st.integers(min_value=0, max_value=6000)
_rotation = st.sampled_from([0, 90, 180, 270])


def _make_placement(
    index: int,
    width_mm: int,
    depth_mm: int,
    x_mm: int,
    y_mm: int,
    rotation: int,
) -> Placement:
    product = Product(
        product_id=f"prod_{index}",
        name=f"prod_{index}",
        category=ProductCategory.CHAIR,
        width_mm=width_mm,
        depth_mm=depth_mm,
        height_mm=500,
        price=Money(amount=Decimal("10.00"), currency="CAD"),
        attributes=ProductAttributes(),
    )
    return Placement(
        instance=ProductInstance(instance_id=f"inst_{index}", product=product),
        x_mm=x_mm,
        y_mm=y_mm,
        rotation_deg=rotation,
    )


@given(
    placements_raw=st.lists(
        st.tuples(_dimension, _dimension, _position, _position, _rotation),
        min_size=0,
        max_size=6,
    )
)
@settings(max_examples=100)
def test_a_passing_layout_never_contains_overlapping_footprints(
    placements_raw: list[tuple[int, int, int, int, int]],
) -> None:
    """For any product set and any placement grid, `check_collisions` flags
    every actual overlap -- so a layout it reports as clean truly has none."""
    placements = tuple(
        _make_placement(i, width, depth, x, y, rotation)
        for i, (width, depth, x, y, rotation) in enumerate(placements_raw)
    )

    violations = check_collisions(placements)

    if not violations:
        from curalina_design_rules.spatial import footprint

        footprints = [footprint(p) for p in placements]
        for i in range(len(footprints)):
            for j in range(i + 1, len(footprints)):
                assert footprints[i].intersection(footprints[j]).area <= 1.0


@given(
    placements_raw=st.lists(
        st.tuples(_dimension, _dimension, _position, _position, _rotation),
        min_size=0,
        max_size=6,
    )
)
@settings(max_examples=100)
def test_violations_are_deterministic_for_same_inputs_and_rules_version(
    placements_raw: list[tuple[int, int, int, int, int]],
) -> None:
    """Same inputs, same rules version => identical violation list, in order."""
    placements = tuple(
        _make_placement(i, width, depth, x, y, rotation)
        for i, (width, depth, x, y, rotation) in enumerate(placements_raw)
    )

    first = check_collisions(placements)
    second = check_collisions(placements)

    assert first == second
    assert RULES.rules_version == load_rules().rules_version
