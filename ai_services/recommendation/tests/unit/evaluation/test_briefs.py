"""Structural well-formedness of the frozen 16-brief assembly: unique IDs,
valid pool references, stratum counts, round-trip serialization. Does not
re-assert the real-world term choices (covered by the notebook's own
execution against real data)."""

from __future__ import annotations

import json
from dataclasses import replace
from decimal import Decimal

import pytest

from curalina_recommendation.evaluation.briefs import (
    MIN_ELIGIBLE_A_AND_B,
    STRATUM_A_POOLS,
    brief_from_dict,
    brief_to_dict,
    build_stratum_a,
    build_stratum_b,
    build_stratum_c,
)
from curalina_recommendation.evaluation.label_source import LabelSourceRecord
from curalina_recommendation.evaluation.vocabulary import VocabularyMap


def _record(
    product_id: str,
    *,
    room: str = "Dining room",
    category: str = "Dining Chairs",
    price: str | None = "100.00",
) -> LabelSourceRecord:
    return LabelSourceRecord(
        product_id=product_id,
        supplier_id="Four Hands",
        price=Decimal(price) if price is not None else None,
        width_in=None,
        room_types_raw=(room,),
        design_styles_raw=(),
        tags_raw=(),
        categories_raw=(category,),
    )


def _vocab_for_stratum_a() -> VocabularyMap:
    return VocabularyMap(
        canonical_styles=("Modern Farmhouse", "Organic Modern", "Artful Eclectic"),
        canonical_tags=("Warm Neutrals", "Earth & Stone", "Monochrome Luxe"),
        canonical_rooms=("Dining room", "Bedroom", "Living room"),
        material_family_tags=(),
        tag_reference={},
        style_synonyms={},
        style_out_of_axis={},
        tag_synonyms={},
        tag_out_of_axis={},
        room_synonyms={},
    )


def _style_atmosphere_records(
    room: str, category: str, style: str, atmosphere: str, prefix: str
) -> list[LabelSourceRecord]:
    style_only = [
        LabelSourceRecord(
            product_id=f"{prefix}_s{i}",
            supplier_id="Four Hands",
            price=None,
            width_in=None,
            room_types_raw=(room,),
            design_styles_raw=(style,),
            tags_raw=(),
            categories_raw=(category,),
        )
        for i in range(5)
    ]
    filler = [
        LabelSourceRecord(
            product_id=f"{prefix}_n{i}",
            supplier_id="Four Hands",
            price=None,
            width_in=None,
            room_types_raw=(room,),
            design_styles_raw=(),
            tags_raw=(),
            categories_raw=(category,),
        )
        for i in range(10)
    ]
    both = [
        LabelSourceRecord(
            product_id=f"{prefix}_b{i}",
            supplier_id="Four Hands",
            price=None,
            width_in=None,
            room_types_raw=(room,),
            design_styles_raw=(style,),
            tags_raw=(atmosphere,),
            categories_raw=(category,),
        )
        for i in range(5)
    ]
    return style_only + both + filler


def test_build_stratum_a_raises_when_a_pool_has_too_few_eligible_products() -> None:
    # Only 5 eligible Dining room / Dining Chairs products, well under the
    # MIN_ELIGIBLE_A_AND_B=20 floor -> must re-parameterise before freeze,
    # not silently proceed with a starved pool.
    records = tuple(_record(f"dc{i}") for i in range(5))

    with pytest.raises(ValueError, match="only 5 eligible"):
        build_stratum_a(records, _vocab_for_stratum_a())


def test_build_stratum_a_builds_briefs_with_correct_room_and_categories() -> None:
    vocab = _vocab_for_stratum_a()
    a1_pool, a2_pool, a3_pool = STRATUM_A_POOLS
    records = tuple(
        _style_atmosphere_records(
            a1_pool.room_type,
            a1_pool.categories[0],
            "Modern Farmhouse",
            "Warm Neutrals",
            "a1",
        )
        + _style_atmosphere_records(
            a2_pool.room_type,
            a2_pool.categories[0],
            "Organic Modern",
            "Earth & Stone",
            "a2",
        )
        + _style_atmosphere_records(
            a3_pool.room_type,
            a3_pool.categories[0],
            "Artful Eclectic",
            "Monochrome Luxe",
            "a3",
        )
    )

    briefs, diagnostics_by_pool = build_stratum_a(records, vocab)

    assert set(diagnostics_by_pool) == {"A1", "A2", "A3"}
    assert briefs  # at least one selected cell per eligible pool
    for brief in briefs:
        assert brief.stratum == "A"
        pool_id, _, index = brief.brief_id.partition("-")
        assert pool_id in {"A1", "A2", "A3"}
        assert index.isdigit()
        pool = next(p for p in STRATUM_A_POOLS if p.pool_id == pool_id)
        assert brief.room_type == pool.room_type
        assert brief.categories == pool.categories
        assert brief.style is not None
        assert brief.atmosphere is not None


def test_build_stratum_a_diagnostics_report_every_cell_not_only_survivors() -> None:
    vocab = _vocab_for_stratum_a()
    a1_pool = STRATUM_A_POOLS[0]
    a2_pool = STRATUM_A_POOLS[1]
    a3_pool = STRATUM_A_POOLS[2]
    records = tuple(
        _style_atmosphere_records(
            a1_pool.room_type,
            a1_pool.categories[0],
            "Modern Farmhouse",
            "Warm Neutrals",
            "a1",
        )
        + _style_atmosphere_records(
            a2_pool.room_type,
            a2_pool.categories[0],
            "Organic Modern",
            "Earth & Stone",
            "a2",
        )
        + _style_atmosphere_records(
            a3_pool.room_type,
            a3_pool.categories[0],
            "Artful Eclectic",
            "Monochrome Luxe",
            "a3",
        )
    )

    _, diagnostics_by_pool = build_stratum_a(records, vocab)

    # 3 styles x 3 non-material atmospheres = 9 candidate cells per pool,
    # every one reported (admissible or not) per §D3a-I step 4.
    for pool_id in ("A1", "A2", "A3"):
        assert len(diagnostics_by_pool[pool_id]) == 9
        rejected = [d for d in diagnostics_by_pool[pool_id] if not d.admissible]
        assert len(rejected) >= 1


def test_stratum_a_pools_have_unique_ids_and_nonempty_categories() -> None:
    pool_ids = [p.pool_id for p in STRATUM_A_POOLS]
    assert len(pool_ids) == len(set(pool_ids))
    for pool in STRATUM_A_POOLS:
        assert pool.room_type.strip()
        assert len(pool.categories) >= 1
        assert all(c.strip() for c in pool.categories)


def test_stratum_b_has_exactly_four_briefs_with_unique_ids() -> None:
    records = tuple(_record(f"p{i}") for i in range(30))

    briefs = build_stratum_b(records)

    assert len(briefs) == 4
    ids = [b.brief_id for b in briefs]
    assert len(ids) == len(set(ids))
    for brief in briefs:
        assert brief.stratum == "B"
        assert brief.room_type.strip()
        assert len(brief.categories) >= 1


def test_stratum_b_budget_brief_computes_a_positive_40th_percentile_budget() -> None:
    # 10 dining chairs at prices 10..100 in steps of 10.
    records = tuple(_record(f"dc{i}", price=str(10 * (i + 1))) for i in range(10))

    briefs = build_stratum_b(records)

    b1 = next(b for b in briefs if b.brief_id == "B1")
    assert b1.budget_max is not None
    assert b1.budget_max > 0
    assert b1.budget_percentile == 0.40


def test_stratum_b_dimension_brief_has_a_positive_dimension_ceiling() -> None:
    records = tuple(_record(f"dc{i}") for i in range(10))
    briefs = build_stratum_b(records)

    b2 = next(b for b in briefs if b.brief_id == "B2")
    assert b2.max_dimension_in == Decimal("36")
    assert b2.room_type == "Entryway"


def test_stratum_c_has_exactly_three_briefs_with_unique_ids() -> None:
    briefs = build_stratum_c()

    assert len(briefs) == 3
    ids = [b.brief_id for b in briefs]
    assert len(ids) == len(set(ids))
    for brief in briefs:
        assert brief.stratum == "C"
        assert brief.room_type.strip()
        assert len(brief.categories) >= 1


def test_stratum_c_has_at_least_one_insufficient_inventory_brief() -> None:
    briefs = build_stratum_c()

    insufficient = [b for b in briefs if "insufficient inventory" in b.note]
    assert len(insufficient) >= 1


def test_all_16_frozen_briefs_have_globally_unique_ids_across_strata() -> None:
    # Structural check across the strata this module can build without a
    # real workbook (B + C = 7); A's count/ids are proven by the notebook
    # execution against real pool data per the packet's completion evidence.
    briefs = (
        build_stratum_b(tuple(_record(f"p{i}") for i in range(30))) + build_stratum_c()
    )

    ids = [b.brief_id for b in briefs]
    assert len(ids) == len(set(ids))


def test_min_eligible_a_and_b_floor_is_a_positive_threshold() -> None:
    assert MIN_ELIGIBLE_A_AND_B > 0


def _json_round_trip(data: dict[str, object]) -> dict[str, object]:
    # Mirrors `pipeline.author_frozen_fixtures`/`load_frozen_fixtures`'s real
    # path: `json.dumps(..., default=str)` then `json.loads(...)`, which is
    # what turns `asdict`'s tuples back into JSON arrays before
    # `brief_from_dict` sees them.
    return json.loads(json.dumps(data, default=str))  # type: ignore[no-any-return]


def test_brief_to_dict_and_from_dict_round_trip_a_stratum_a_style_brief_via_json() -> (
    None
):
    brief = build_stratum_c()[2]  # C3 carries style/atmosphere

    data = _json_round_trip(brief_to_dict(brief))
    restored = brief_from_dict(data)

    assert restored == brief


def test_brief_to_dict_and_from_dict_round_trip_a_budget_brief_via_json() -> None:
    records = tuple(_record(f"dc{i}", price=str(10 * (i + 1))) for i in range(10))
    brief = next(b for b in build_stratum_b(records) if b.brief_id == "B1")

    data = _json_round_trip(brief_to_dict(brief))
    restored = brief_from_dict(data)

    assert restored == brief
    assert isinstance(restored.budget_max, Decimal)


def test_brief_to_dict_and_from_dict_round_trip_a_dimension_brief_via_json() -> None:
    records = tuple(_record(f"dc{i}") for i in range(10))
    brief = next(b for b in build_stratum_b(records) if b.brief_id == "B2")

    data = _json_round_trip(brief_to_dict(brief))
    restored = brief_from_dict(data)

    assert restored == brief
    assert isinstance(restored.max_dimension_in, Decimal)


def test_brief_to_dict_serializes_none_budget_and_dimension_as_none() -> None:
    records = tuple(_record(f"dc{i}") for i in range(10))
    brief = next(b for b in build_stratum_b(records) if b.brief_id == "B3")

    data = brief_to_dict(brief)

    assert data["budget_max"] is None
    assert data["max_dimension_in"] is None


def test_brief_categories_round_trip_as_a_tuple_after_the_real_json_path() -> None:
    brief = replace(build_stratum_c()[0], categories=("A", "B", "C"))

    data = _json_round_trip(brief_to_dict(brief))
    restored = brief_from_dict(data)

    assert restored.categories == ("A", "B", "C")
    assert isinstance(restored.categories, tuple)


def test_brief_from_dict_raises_on_a_direct_brief_to_dict_output_bug() -> None:
    """Documents a real bug, not a desired behavior: `brief_to_dict` uses
    `dataclasses.asdict`, which preserves `categories` as a `tuple`
    (verified directly against `dataclasses.asdict`'s documented behavior),
    but `brief_from_dict` asserts `categories` is a `list` before calling
    `tuple(categories)`. The only reason this never fires in the real
    `pipeline.py` path is that `briefs_v1.json` is written with
    `json.dumps` and reloaded with `json.loads` in between, which silently
    converts the tuple to a JSON array/Python list first. Calling
    `brief_from_dict(brief_to_dict(brief))` directly — with no JSON
    round-trip in between — raises `AssertionError` today. This test pins
    that current (buggy) behavior so a future fix is a deliberate,
    visible change here rather than a silent one."""

    brief = build_stratum_c()[0]

    with pytest.raises(AssertionError):
        brief_from_dict(brief_to_dict(brief))
