"""§D3a-I Stratum A pool/cell selection: discriminativeness band, floors,
the Jaccard collinearity guard, and material-tag exclusion from the
atmosphere axis — against constructed synthetic product sets with known
expected outcomes, not the real workbook."""

from __future__ import annotations

from curalina_recommendation.evaluation.briefs import _eligible_atmospheres
from curalina_recommendation.evaluation.label_source import LabelSourceRecord
from curalina_recommendation.evaluation.pool_selection import (
    MAX_JACCARD_STYLE_TAG,
    MIN_GRADE2,
    MIN_POSITIVES,
    R_UNION_MAX,
    R_UNION_MIN,
    PoolSpec,
    cell_diagnostics_for_pool,
    pool_records,
    select_stratum_a_cells,
)
from curalina_recommendation.evaluation.vocabulary import (
    MATERIAL_FAMILY_TAGS,
    VocabularyMap,
)

_POOL = PoolSpec(pool_id="T1", room_type="Dining room", categories=("Dining Chairs",))


def _vocab(**overrides: object) -> VocabularyMap:
    defaults: dict[str, object] = dict(
        canonical_styles=("Modern Farmhouse", "Organic Modern"),
        canonical_tags=(
            "Warm Neutrals",
            "Earth & Stone",
            "Monochrome Luxe",
            *MATERIAL_FAMILY_TAGS,
        ),
        canonical_rooms=("Dining room",),
        material_family_tags=MATERIAL_FAMILY_TAGS,
        tag_reference={},
        style_synonyms={},
        style_out_of_axis={},
        tag_synonyms={},
        tag_out_of_axis={},
        room_synonyms={},
    )
    defaults.update(overrides)
    return VocabularyMap(**defaults)  # type: ignore[arg-type]


def _record(
    product_id: str,
    *,
    styles: tuple[str, ...] = (),
    tags: tuple[str, ...] = (),
    supplier: str = "Four Hands",
) -> LabelSourceRecord:
    return LabelSourceRecord(
        product_id=product_id,
        supplier_id=supplier,
        price=None,
        width_in=None,
        room_types_raw=("Dining room",),
        design_styles_raw=styles,
        tags_raw=tags,
        categories_raw=("Dining Chairs",),
    )


def test_cell_inside_the_admissible_r_union_band_is_admissible() -> None:
    # 20 products: 7 tagged "Modern Farmhouse" only, 0 tagged "Warm
    # Neutrals" only, 3 tagged with both -> union = 10/20 = 0.50, inside
    # [0.15, 0.60]; grade2 (intersection) = 3, meeting the floor of 3.
    recs = tuple(
        [_record(f"s{i}", styles=("Modern Farmhouse",)) for i in range(7)]
        + [
            _record(f"b{i}", styles=("Modern Farmhouse",), tags=("Warm Neutrals",))
            for i in range(3)
        ]
        + [_record(f"n{i}") for i in range(10)]
    )
    vocab = _vocab()

    diagnostics, _ = cell_diagnostics_for_pool(
        _POOL, recs, vocab, ("Modern Farmhouse",), ("Warm Neutrals",)
    )

    assert len(diagnostics) == 1
    cell = diagnostics[0]
    assert cell.positives == 10
    assert cell.grade2 == 3
    assert cell.r_union == 0.5
    assert R_UNION_MIN <= cell.r_union <= R_UNION_MAX
    assert cell.admissible
    assert cell.guards_failed == ()


def test_cell_above_r_union_max_is_rejected_with_the_named_guard() -> None:
    # 18/20 = 0.90 union, well above the 0.60 ceiling.
    recs = tuple(
        [_record(f"s{i}", styles=("Modern Farmhouse",)) for i in range(15)]
        + [
            _record(f"b{i}", styles=("Modern Farmhouse",), tags=("Warm Neutrals",))
            for i in range(3)
        ]
        + [_record(f"n{i}") for i in range(2)]
    )
    vocab = _vocab()

    diagnostics, _ = cell_diagnostics_for_pool(
        _POOL, recs, vocab, ("Modern Farmhouse",), ("Warm Neutrals",)
    )

    cell = diagnostics[0]
    assert cell.r_union == 0.9
    assert not cell.admissible
    assert "r_union_out_of_band" in cell.guards_failed


def test_cell_below_r_union_min_is_rejected_with_the_named_guard() -> None:
    # 2/20 = 0.10 union, below the 0.15 floor.
    recs = tuple(
        [_record(f"s{i}", styles=("Modern Farmhouse",)) for i in range(2)]
        + [_record(f"n{i}") for i in range(18)]
    )
    vocab = _vocab()

    diagnostics, _ = cell_diagnostics_for_pool(
        _POOL, recs, vocab, ("Modern Farmhouse",), ("Warm Neutrals",)
    )

    cell = diagnostics[0]
    assert cell.r_union == 0.10
    assert not cell.admissible
    assert "r_union_out_of_band" in cell.guards_failed


def test_cell_below_min_positives_floor_is_rejected_even_inside_r_union_band() -> None:
    # A tiny pool where r_union sits inside [0.15, 0.60] but the absolute
    # positive count (9) is under the MIN_POSITIVES=10 floor.
    n_total = 20
    n_positive = 9  # 9/20 = 0.45, inside band, but < MIN_POSITIVES
    recs = tuple(
        [_record(f"s{i}", styles=("Modern Farmhouse",)) for i in range(n_positive)]
        + [_record(f"n{i}") for i in range(n_total - n_positive)]
    )
    vocab = _vocab()

    diagnostics, _ = cell_diagnostics_for_pool(
        _POOL, recs, vocab, ("Modern Farmhouse",), ("Warm Neutrals",)
    )

    cell = diagnostics[0]
    assert cell.positives == 9
    assert cell.positives < MIN_POSITIVES
    assert R_UNION_MIN <= cell.r_union <= R_UNION_MAX
    assert not cell.admissible
    assert "insufficient_positives" in cell.guards_failed


def test_cell_below_min_grade2_floor_is_rejected() -> None:
    # union = 10/20 = 0.50 (inside band, >= MIN_POSITIVES) but only 2
    # products carry both style and tag (< MIN_GRADE2 = 3).
    recs = tuple(
        [_record(f"s{i}", styles=("Modern Farmhouse",)) for i in range(8)]
        + [
            _record(f"b{i}", styles=("Modern Farmhouse",), tags=("Warm Neutrals",))
            for i in range(2)
        ]
        + [_record(f"n{i}") for i in range(10)]
    )
    vocab = _vocab()

    diagnostics, _ = cell_diagnostics_for_pool(
        _POOL, recs, vocab, ("Modern Farmhouse",), ("Warm Neutrals",)
    )

    cell = diagnostics[0]
    assert cell.grade2 == 2
    assert cell.grade2 < MIN_GRADE2
    assert not cell.admissible
    assert "insufficient_grade2" in cell.guards_failed


def test_jaccard_collinearity_guard_rejects_near_identical_style_and_tag() -> None:
    # Style and tag sets are identical except for one product each way ->
    # Jaccard = 8/10 = 0.80 >= the 0.60 collinearity ceiling.
    common = [
        _record(f"c{i}", styles=("Modern Farmhouse",), tags=("Warm Neutrals",))
        for i in range(8)
    ]
    style_only = [_record("style_only", styles=("Modern Farmhouse",))]
    tag_only = [_record("tag_only", tags=("Warm Neutrals",))]
    filler = [_record(f"n{i}") for i in range(10)]
    recs = tuple(common + style_only + tag_only + filler)
    vocab = _vocab()

    diagnostics, _ = cell_diagnostics_for_pool(
        _POOL, recs, vocab, ("Modern Farmhouse",), ("Warm Neutrals",)
    )

    cell = diagnostics[0]
    assert cell.jaccard_style_tag == 8 / 10
    assert cell.jaccard_style_tag >= MAX_JACCARD_STYLE_TAG
    assert not cell.admissible
    assert "style_tag_collinear" in cell.guards_failed


def test_jaccard_below_collinearity_ceiling_does_not_trigger_the_guard() -> None:
    # Deliberately construct a cell where style/tag overlap is well under
    # the 0.60 Jaccard ceiling, and every other guard is satisfied.
    both = [
        _record(f"both{i}", styles=("Modern Farmhouse",), tags=("Warm Neutrals",))
        for i in range(3)
    ]
    style_only = [_record(f"style{i}", styles=("Modern Farmhouse",)) for i in range(7)]
    tag_only = [_record(f"tag{i}", tags=("Warm Neutrals",)) for i in range(4)]
    # union = 3 + 7 + 4 = 14; jaccard = 3 / (3+7+4) = 3/14 ~= 0.214
    filler = [_record(f"n{i}") for i in range(6)]
    recs = tuple(both + style_only + tag_only + filler)
    vocab = _vocab()

    diagnostics, _ = cell_diagnostics_for_pool(
        _POOL, recs, vocab, ("Modern Farmhouse",), ("Warm Neutrals",)
    )

    cell = diagnostics[0]
    assert cell.jaccard_style_tag < MAX_JACCARD_STYLE_TAG
    assert "style_tag_collinear" not in cell.guards_failed


def test_material_family_tags_are_excluded_from_the_eligible_atmosphere_axis() -> None:
    vocab = _vocab()

    atmospheres = _eligible_atmospheres(vocab)

    for material_tag in MATERIAL_FAMILY_TAGS:
        assert material_tag not in atmospheres
    # Non-material canonical tags remain eligible.
    assert "Warm Neutrals" in atmospheres
    assert "Earth & Stone" in atmospheres
    assert "Monochrome Luxe" in atmospheres


def test_select_stratum_a_cells_returns_all_diagnostics_including_rejected() -> None:
    # One admissible cell, one rejected (out of band) cell.
    admissible_recs = [_record(f"s{i}", styles=("Modern Farmhouse",)) for i in range(7)]
    admissible_recs += [
        _record(f"b{i}", styles=("Modern Farmhouse",), tags=("Warm Neutrals",))
        for i in range(3)
    ]
    admissible_recs += [_record(f"n{i}") for i in range(10)]

    rejected_recs = [_record(f"o{i}", styles=("Organic Modern",)) for i in range(1)]
    rejected_recs += [_record(f"on{i}") for i in range(19)]

    recs = tuple(admissible_recs + rejected_recs)
    vocab = _vocab()

    all_diag, chosen = select_stratum_a_cells(
        _POOL,
        recs,
        vocab,
        ("Modern Farmhouse", "Organic Modern"),
        ("Warm Neutrals", "Earth & Stone"),
    )

    # 2 styles x 2 atmospheres = 4 cells total, all reported.
    assert len(all_diag) == 4
    rejected = [d for d in all_diag if not d.admissible]
    assert len(rejected) >= 1
    assert len(chosen) == 1
    assert chosen[0].style == "Modern Farmhouse"
    assert chosen[0].atmosphere == "Warm Neutrals"


def test_select_stratum_a_cells_never_reuses_a_style_or_atmosphere() -> None:
    # Two admissible cells sharing "Modern Farmhouse" as style; selection
    # must not pick both since a style may only be used once.
    def _make_admissible(style: str, tag: str, suffix: str) -> list[LabelSourceRecord]:
        recs = [_record(f"s{style}{suffix}{i}", styles=(style,)) for i in range(7)]
        recs += [
            _record(f"b{style}{suffix}{i}", styles=(style,), tags=(tag,))
            for i in range(3)
        ]
        return recs

    cell_1 = _make_admissible("Modern Farmhouse", "Warm Neutrals", "a")
    cell_2 = _make_admissible("Modern Farmhouse", "Earth & Stone", "b")
    filler = [_record(f"n{i}") for i in range(20)]
    recs = tuple(cell_1 + cell_2 + filler)
    vocab = _vocab()

    _, chosen = select_stratum_a_cells(
        _POOL,
        recs,
        vocab,
        ("Modern Farmhouse",),
        ("Warm Neutrals", "Earth & Stone"),
        count=3,
    )

    styles_used = [c.style for c in chosen]
    assert len(styles_used) == len(set(styles_used))
    # Only one of the two same-style cells could ever be chosen.
    assert len(chosen) == 1


def test_pool_records_filters_by_room_type_and_category_case_insensitively() -> None:
    matching = _record("m1", styles=("Modern Farmhouse",))
    wrong_room = LabelSourceRecord(
        product_id="wrong_room",
        supplier_id="Four Hands",
        price=None,
        width_in=None,
        room_types_raw=("Living room",),
        design_styles_raw=(),
        tags_raw=(),
        categories_raw=("Dining Chairs",),
    )
    wrong_category = LabelSourceRecord(
        product_id="wrong_cat",
        supplier_id="Four Hands",
        price=None,
        width_in=None,
        room_types_raw=("Dining room",),
        design_styles_raw=(),
        tags_raw=(),
        categories_raw=("Sofa",),
    )
    case_variant = LabelSourceRecord(
        product_id="case_variant",
        supplier_id="Four Hands",
        price=None,
        width_in=None,
        room_types_raw=("DINING ROOM",),
        design_styles_raw=(),
        tags_raw=(),
        categories_raw=("dining chairs",),
    )

    result = pool_records(_POOL, (matching, wrong_room, wrong_category, case_variant))

    ids = {r.product_id for r in result}
    assert ids == {"m1", "case_variant"}


def test_supplier_proxy_guard_rejects_positives_skewed_toward_one_supplier() -> None:
    # Mixed pool: 60% Four Hands / 40% Moe's (minority 0.40 >= the 0.15
    # floor), but every positive product happens to be Four Hands ->
    # fh_share_positive (1.0) diverges from fh_share_pool (0.60) by 0.40,
    # well over the 0.15 supplier-proxy guard.
    fh_positive = [
        _record(
            f"fhp{i}",
            styles=("Modern Farmhouse",),
            tags=("Warm Neutrals",),
            supplier="Four Hands",
        )
        for i in range(5)
    ]
    fh_filler = [_record(f"fhn{i}", supplier="Four Hands") for i in range(7)]
    moes_filler = [_record(f"mon{i}", supplier="Moe's Home") for i in range(8)]
    recs = tuple(fh_positive + fh_filler + moes_filler)
    vocab = _vocab()

    diagnostics, _ = cell_diagnostics_for_pool(
        _POOL, recs, vocab, ("Modern Farmhouse",), ("Warm Neutrals",)
    )

    cell = diagnostics[0]
    assert cell.fh_share_pool == 12 / 20  # 0.60
    assert cell.fh_share_positive == 1.0
    assert not cell.admissible
    assert "supplier_proxy" in cell.guards_failed


def test_supplier_proxy_guard_is_inert_for_a_supplier_homogeneous_pool() -> None:
    # 100% Four Hands pool -> minority_share = 0.0, below the 0.15 floor,
    # so the guard never triggers regardless of positive skew.
    recs = tuple(
        [
            _record(f"s{i}", styles=("Modern Farmhouse",), tags=("Warm Neutrals",))
            for i in range(5)
        ]
        + [_record(f"n{i}") for i in range(15)]
    )
    vocab = _vocab()

    diagnostics, _ = cell_diagnostics_for_pool(
        _POOL, recs, vocab, ("Modern Farmhouse",), ("Warm Neutrals",)
    )

    cell = diagnostics[0]
    assert cell.fh_share_pool == 1.0
    assert "supplier_proxy" not in cell.guards_failed


def test_select_stratum_a_cells_skips_a_cell_colliding_with_a_chosen_atmosphere() -> (
    None
):
    # `Warm Neutrals` and `Earth & Stone` are carried on the exact same 10
    # product IDs (every product in group P has both tags), so their tag
    # sets are literally identical -> Jaccard == 1.0, over the 0.60
    # atmosphere-collinearity ceiling. Two otherwise-admissible cells built
    # on top of that shared tag group must not both be chosen.
    p1 = [
        _record(
            f"p1_{i}",
            styles=("Modern Farmhouse",),
            tags=("Warm Neutrals", "Earth & Stone"),
        )
        for i in range(5)
    ]
    p2 = [
        _record(
            f"p2_{i}",
            styles=("Organic Modern",),
            tags=("Warm Neutrals", "Earth & Stone"),
        )
        for i in range(5)
    ]
    style_farmhouse_only = [
        _record(f"sf{i}", styles=("Modern Farmhouse",)) for i in range(5)
    ]
    style_organic_only = [
        _record(f"so{i}", styles=("Organic Modern",)) for i in range(5)
    ]
    filler = [_record(f"n{i}") for i in range(10)]
    recs = tuple(p1 + p2 + style_farmhouse_only + style_organic_only + filler)
    vocab = _vocab()

    all_diag, chosen = select_stratum_a_cells(
        _POOL,
        recs,
        vocab,
        ("Modern Farmhouse", "Organic Modern"),
        ("Warm Neutrals", "Earth & Stone"),
        count=3,
    )

    admissible = [d for d in all_diag if d.admissible]
    assert len(admissible) >= 2  # both cells are individually admissible
    # But selection must not choose both, since their atmospheres collide.
    assert len(chosen) == 1
    assert chosen[0].style == "Modern Farmhouse"
    # "Earth & Stone" sorts alphabetically before "Warm Neutrals", and the
    # two atmospheres are diagnostically identical here (same tag_set) ->
    # it is the one selected first; every remaining admissible cell then
    # collides with it (same style, or the same-Jaccard atmosphere).
    assert chosen[0].atmosphere == "Earth & Stone"


def test_select_stratum_a_cells_stops_once_the_requested_count_is_reached() -> None:
    # Three fully independent, non-conflicting admissible cells; a count=2
    # request must select exactly 2, never all 3 (proves the early break).
    def _independent_cell(style: str, tag: str) -> list[LabelSourceRecord]:
        recs = [_record(f"s_{style}_{tag}_{i}", styles=(style,)) for i in range(5)]
        recs += [
            _record(f"b_{style}_{tag}_{i}", styles=(style,), tags=(tag,))
            for i in range(5)
        ]
        return recs

    recs = tuple(
        _independent_cell("Modern Farmhouse", "Warm Neutrals")
        + _independent_cell("Organic Modern", "Earth & Stone")
        + _independent_cell("Artful Eclectic", "Monochrome Luxe")
    )
    vocab = _vocab(
        canonical_styles=("Modern Farmhouse", "Organic Modern", "Artful Eclectic")
    )

    _, chosen = select_stratum_a_cells(
        _POOL,
        recs,
        vocab,
        ("Modern Farmhouse", "Organic Modern", "Artful Eclectic"),
        ("Warm Neutrals", "Earth & Stone", "Monochrome Luxe"),
        count=2,
    )

    assert len(chosen) == 2


def test_r_union_at_exact_band_boundaries_is_admissible() -> None:
    # r_union == R_UNION_MIN exactly (0.15): 3/20, but must also clear
    # MIN_POSITIVES=10, so scale to 100 products for a clean boundary case.
    n_total = 100
    n_positive = 15  # exactly 0.15
    recs = tuple(
        [_record(f"s{i}", styles=("Modern Farmhouse",)) for i in range(10)]
        + [
            _record(f"b{i}", styles=("Modern Farmhouse",), tags=("Warm Neutrals",))
            for i in range(5)
        ]
        + [_record(f"n{i}") for i in range(n_total - n_positive)]
    )
    vocab = _vocab()

    diagnostics, _ = cell_diagnostics_for_pool(
        _POOL, recs, vocab, ("Modern Farmhouse",), ("Warm Neutrals",)
    )

    cell = diagnostics[0]
    assert cell.r_union == 0.15
    assert cell.grade2 == 5
    assert cell.admissible
