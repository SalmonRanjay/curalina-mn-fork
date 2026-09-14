"""Assembles the frozen 16-brief evaluation set: Stratum A (9, selected by
`pool_selection`), Stratum B (4, constraint-restrictive), Stratum C (3,
adversarial/expected-negative) — per ADR-0006 §D3 and Amendment 1 §D3a-H.

Vocabulary provenance: every `style`/`atmosphere`/`room_type`/`category`
value here is verbatim from the mapper workbook's `SUB-CATEGORIES` sheet
(checked by `pool_selection`'s `VocabularyMap.canonical_*` lists) — nothing
is coined by this module.
"""

from __future__ import annotations

from dataclasses import asdict
from decimal import Decimal

from curalina_recommendation.evaluation.label_rules import Brief
from curalina_recommendation.evaluation.label_source import LabelSourceRecord
from curalina_recommendation.evaluation.pool_selection import (
    CellDiagnostic,
    PoolSpec,
    pool_records,
    select_stratum_a_cells,
)
from curalina_recommendation.evaluation.vocabulary import (
    MATERIAL_FAMILY_TAGS,
    VocabularyMap,
)

MIN_ELIGIBLE_A_AND_B = 20

STRATUM_A_POOLS: tuple[PoolSpec, ...] = (
    PoolSpec(
        pool_id="A1",
        room_type="Dining room",
        categories=("Dining Chairs", "Dining Table", "Dining Bench"),
    ),
    PoolSpec(pool_id="A2", room_type="Bedroom", categories=("Nightstand",)),
    PoolSpec(
        pool_id="A3",
        room_type="Living room",
        categories=("Sofa", "Sectional", "Console Table", "Shelving Unit", "Bookcase"),
    ),
)


def _eligible_atmospheres(vocab: VocabularyMap) -> tuple[str, ...]:
    return tuple(t for t in vocab.canonical_tags if t not in MATERIAL_FAMILY_TAGS)


def build_stratum_a(
    records: tuple[LabelSourceRecord, ...], vocab: VocabularyMap
) -> tuple[list[Brief], dict[str, list[CellDiagnostic]]]:
    """Returns `(briefs, diagnostics_by_pool)`. `diagnostics_by_pool` holds
    every candidate cell, admitted or not, per §D3a-I step 4."""

    briefs: list[Brief] = []
    diagnostics_by_pool: dict[str, list[CellDiagnostic]] = {}
    atmospheres = _eligible_atmospheres(vocab)
    for pool in STRATUM_A_POOLS:
        recs = pool_records(pool, records)
        if len(recs) < MIN_ELIGIBLE_A_AND_B:
            raise ValueError(
                f"Stratum A pool {pool.pool_id} has only {len(recs)} eligible "
                f"products (< {MIN_ELIGIBLE_A_AND_B}); re-parameterise before freeze"
            )
        all_diag, chosen = select_stratum_a_cells(
            pool, recs, vocab, vocab.canonical_styles, atmospheres
        )
        diagnostics_by_pool[pool.pool_id] = all_diag
        for i, cell in enumerate(chosen, start=1):
            briefs.append(
                Brief(
                    brief_id=f"{pool.pool_id}-{i}",
                    stratum="A",
                    room_type=pool.room_type,
                    categories=pool.categories,
                    style=cell.style,
                    atmosphere=cell.atmosphere,
                )
            )
    return briefs, diagnostics_by_pool


def _percentile(values: list[Decimal], pct: float) -> Decimal:
    ordered = sorted(values)
    idx = min(len(ordered) - 1, max(0, int(round(pct * (len(ordered) - 1)))))
    return ordered[idx]


def _eligible_for(
    records: tuple[LabelSourceRecord, ...], room_type: str, categories: tuple[str, ...]
) -> list[LabelSourceRecord]:
    wanted = {c.strip().lower() for c in categories}
    out = []
    for r in records:
        room_lower = room_type.strip().lower()
        room_ok = any(t.strip().lower() == room_lower for t in r.room_types_raw)
        cat_ok = any(t.strip().lower() in wanted for t in r.categories_raw)
        if room_ok and cat_ok:
            out.append(r)
    return out


def build_stratum_b(records: tuple[LabelSourceRecord, ...]) -> list[Brief]:
    """4 constraint-restrictive briefs: low budget, tight dimension
    ceiling, single required category, multi-category (§D3)."""

    briefs: list[Brief] = []

    # B1 — low budget, single category (Dining Chairs).
    dining_chairs = _eligible_for(records, "Dining room", ("Dining Chairs",))
    prices = [r.price for r in dining_chairs if r.price is not None]
    budget = _percentile(prices, 0.40)
    briefs.append(
        Brief(
            brief_id="B1",
            stratum="B",
            room_type="Dining room",
            categories=("Dining Chairs",),
            budget_max=budget,
            budget_percentile=0.40,
            note="low-budget: 40th percentile of eligible price distribution",
        )
    )

    # B2 — tight dimension ceiling, single category (Console Table).
    briefs.append(
        Brief(
            brief_id="B2",
            stratum="B",
            room_type="Entryway",
            categories=("Console Table",),
            max_dimension_in=Decimal("36"),
            note="tight dimension ceiling: 36in width cap for an entryway console",
        )
    )

    # B3 — single required category (Nightstand), no budget/dimension cap.
    briefs.append(
        Brief(
            brief_id="B3",
            stratum="B",
            room_type="Bedroom",
            categories=("Nightstand",),
            note="single required category, unconstrained budget/dimension",
        )
    )

    # B4 — multi-category (Sofa, Console Table).
    briefs.append(
        Brief(
            brief_id="B4",
            stratum="B",
            room_type="Living room",
            categories=("Sofa", "Console Table"),
            note="multi-category: sofa or console table for one living room brief",
        )
    )
    return briefs


def build_stratum_c() -> list[Brief]:
    """3 adversarial/expected-negative briefs (§D3, mandatory). C1/C2 are
    the "correct answer is insufficient eligible inventory" cases ADR-0005
    established this catalogue has zero of (lighting, accent chairs); C3 is
    a real-inventory, zero-positive-label ranking-adversarial case (an
    Four-Hands-only pool crossed with a Moe's-exclusive atmosphere tag)."""

    return [
        Brief(
            brief_id="C1",
            stratum="C",
            room_type="Living room",
            categories=(
                "Table Lamp",
                "Floor Lamp",
                "Outdoor Lamp",
                "Pendant Light",
                "Chandelier Light",
                "Light Sconce",
            ),
            note="expected outcome: insufficient inventory (zero lighting, ADR-0005)",
        ),
        Brief(
            brief_id="C2",
            stratum="C",
            room_type="Living room",
            categories=("Accent Chair",),
            note="expected: insufficient inventory (zero accent chairs, ADR-0005)",
        ),
        Brief(
            brief_id="C3",
            stratum="C",
            room_type="Dining room",
            categories=("Dining Chairs", "Dining Table", "Dining Bench"),
            style="Mid-Century Scandi",
            atmosphere="Elegant/Balanced",
            note=(
                "expected outcome: zero/near-zero positives — 'Elegant/Balanced' is "
                "supplier-disjoint toward Moe's Home while pool A1 is ~100% Four Hands "
                "(§D3a-G); real inventory exists, the correct ranking answer is 'no "
                "relevant items', not an empty pool"
            ),
        ),
    ]


def brief_to_dict(brief: Brief) -> dict[str, object]:
    data = asdict(brief)
    data["budget_max"] = str(brief.budget_max) if brief.budget_max is not None else None
    data["max_dimension_in"] = (
        str(brief.max_dimension_in) if brief.max_dimension_in is not None else None
    )
    return data


def brief_from_dict(data: dict[str, object]) -> Brief:
    raw = dict(data)
    if raw.get("budget_max") is not None:
        raw["budget_max"] = Decimal(str(raw["budget_max"]))
    if raw.get("max_dimension_in") is not None:
        raw["max_dimension_in"] = Decimal(str(raw["max_dimension_in"]))
    categories = raw["categories"]
    assert isinstance(categories, list)
    raw["categories"] = tuple(categories)
    return Brief(**raw)  # type: ignore[arg-type]
