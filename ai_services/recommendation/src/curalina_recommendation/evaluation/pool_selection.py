"""§D3a-I Stratum A pool/cell selection procedure (Amendment 1 to
ADR-0006). Selects 3 (style, atmosphere) briefs per pool by
within-pool discriminativeness, never by catalogue-wide frequency
(§D3a's superseded rule).
"""

from __future__ import annotations

from dataclasses import dataclass

from curalina_recommendation.evaluation.label_rules import AxisStatus, evaluate_axis
from curalina_recommendation.evaluation.label_source import LabelSourceRecord
from curalina_recommendation.evaluation.vocabulary import VocabularyMap

R_UNION_MIN = 0.15
R_UNION_MAX = 0.60
MIN_POSITIVES = 10
MIN_GRADE2 = 3
MAX_JACCARD_STYLE_TAG = 0.60
MAX_ATMOSPHERE_JACCARD = 0.60
SUPPLIER_PROXY_GUARD = 0.15
MIXED_POOL_MINORITY_FLOOR = 0.15
OBJECTIVE_CENTER = 0.35


@dataclass(frozen=True, slots=True)
class PoolSpec:
    pool_id: str
    room_type: str
    categories: tuple[str, ...]


@dataclass(frozen=True, slots=True)
class CellDiagnostic:
    pool_id: str
    style: str
    atmosphere: str
    pool_size: int
    positives: int
    grade2: int
    r_union: float
    r_grade2: float
    jaccard_style_tag: float
    fh_share_pool: float
    fh_share_positive: float | None
    guards_failed: tuple[str, ...]

    @property
    def admissible(self) -> bool:
        return not self.guards_failed


def pool_records(
    pool: PoolSpec, records: tuple[LabelSourceRecord, ...]
) -> tuple[LabelSourceRecord, ...]:
    wanted = {c.strip().lower() for c in pool.categories}

    def in_pool(r: LabelSourceRecord) -> bool:
        room_ok = any(
            t.strip().lower() == pool.room_type.strip().lower()
            for t in r.room_types_raw
        )
        cat_ok = any(t.strip().lower() in wanted for t in r.categories_raw)
        return room_ok and cat_ok

    return tuple(r for r in records if in_pool(r))


def _indicator_sets(
    recs: tuple[LabelSourceRecord, ...],
    terms: tuple[str, ...],
    axis: str,
    vocab: VocabularyMap,
) -> dict[str, set[str]]:
    out: dict[str, set[str]] = {t: set() for t in terms}
    for r in recs:
        tokens = r.design_styles_raw if axis == "style" else r.tags_raw
        for term in terms:
            result = evaluate_axis(tokens, axis, term, vocab)
            if result.status is AxisStatus.RESOLVED and result.matched:
                out[term].add(r.product_id)
    return out


def _jaccard(a: set[str], b: set[str]) -> float:
    if not a and not b:
        return 0.0
    return len(a & b) / len(a | b)


def cell_diagnostics_for_pool(
    pool: PoolSpec,
    recs: tuple[LabelSourceRecord, ...],
    vocab: VocabularyMap,
    styles: tuple[str, ...],
    atmospheres: tuple[str, ...],
) -> tuple[list[CellDiagnostic], dict[str, set[str]]]:
    n = len(recs)
    fh_ids = {r.product_id for r in recs if r.supplier_id == "Four Hands"}
    style_sets = _indicator_sets(recs, styles, "style", vocab)
    tag_sets = _indicator_sets(recs, atmospheres, "tag", vocab)
    diagnostics: list[CellDiagnostic] = []
    for style in styles:
        for atmosphere in atmospheres:
            s_set = style_sets[style]
            t_set = tag_sets[atmosphere]
            union = s_set | t_set
            inter = s_set & t_set
            r_union = len(union) / n if n else 0.0
            r_grade2 = len(inter) / n if n else 0.0
            jaccard = _jaccard(s_set, t_set)
            fh_share_pool = len(fh_ids) / n if n else 0.0
            fh_share_positive = len(union & fh_ids) / len(union) if union else None
            guards_failed: list[str] = []
            if not (R_UNION_MIN <= r_union <= R_UNION_MAX):
                guards_failed.append("r_union_out_of_band")
            if len(union) < MIN_POSITIVES:
                guards_failed.append("insufficient_positives")
            if len(inter) < MIN_GRADE2:
                guards_failed.append("insufficient_grade2")
            if jaccard >= MAX_JACCARD_STYLE_TAG:
                guards_failed.append("style_tag_collinear")
            minority_share = min(fh_share_pool, 1 - fh_share_pool)
            if (
                minority_share >= MIXED_POOL_MINORITY_FLOOR
                and fh_share_positive is not None
                and abs(fh_share_positive - fh_share_pool) > SUPPLIER_PROXY_GUARD
            ):
                guards_failed.append("supplier_proxy")
            diagnostics.append(
                CellDiagnostic(
                    pool_id=pool.pool_id,
                    style=style,
                    atmosphere=atmosphere,
                    pool_size=n,
                    positives=len(union),
                    grade2=len(inter),
                    r_union=r_union,
                    r_grade2=r_grade2,
                    jaccard_style_tag=jaccard,
                    fh_share_pool=fh_share_pool,
                    fh_share_positive=fh_share_positive,
                    guards_failed=tuple(guards_failed),
                )
            )
    return diagnostics, tag_sets


def select_stratum_a_cells(
    pool: PoolSpec,
    recs: tuple[LabelSourceRecord, ...],
    vocab: VocabularyMap,
    styles: tuple[str, ...],
    atmospheres: tuple[str, ...],
    *,
    count: int = 3,
) -> tuple[list[CellDiagnostic], list[CellDiagnostic]]:
    """Returns `(all_diagnostics, selected)`. `all_diagnostics` includes
    every rejected cell with the guard(s) it failed — §D3a-I step 4 forbids
    reporting only the survivors."""

    all_diag, tag_sets = cell_diagnostics_for_pool(
        pool, recs, vocab, styles, atmospheres
    )
    admissible = [d for d in all_diag if d.admissible]
    admissible.sort(
        key=lambda d: (
            abs(d.r_union - OBJECTIVE_CENTER),
            -d.grade2,
            d.style,
            d.atmosphere,
        )
    )
    chosen: list[CellDiagnostic] = []
    used_styles: set[str] = set()
    used_atmospheres: set[str] = set()
    for d in admissible:
        if d.style in used_styles or d.atmosphere in used_atmospheres:
            continue
        conflict = any(
            _jaccard(tag_sets[d.atmosphere], tag_sets[c.atmosphere])
            >= MAX_ATMOSPHERE_JACCARD
            for c in chosen
        )
        if conflict:
            continue
        chosen.append(d)
        used_styles.add(d.style)
        used_atmospheres.add(d.atmosphere)
        if len(chosen) == count:
            break
    return all_diag, chosen
