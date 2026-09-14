"""Runs every `FeatureEncoder` arm over every brief's candidate set and
computes the required metrics/controls: per-brief and per-supplier
Precision@5/NDCG@5 (ADR-0006 §D7, ADR-0007's per-supplier requirement),
the prevalence baseline (§D6b), the shuffled-label control (§D7), and the
mixed-pool supplier-proxy guard (Amendment 1 §D3a-G).
"""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from typing import Protocol

from curalina_recommendation.adapters.xlsx_catalogue_importer import (
    XlsxCatalogueImporter,
)
from curalina_recommendation.domain.money import Money
from curalina_recommendation.domain.product import Product
from curalina_recommendation.domain.profile import Profile
from curalina_recommendation.domain.ranking import RankedCandidate
from curalina_recommendation.evaluation.candidates import CandidateSet
from curalina_recommendation.evaluation.label_rules import Brief
from curalina_recommendation.evaluation.metrics import (
    K,
    PrevalenceBaseline,
    ndcg_at_k,
    precision_at_k,
    prevalence_baseline,
    shuffled_labels,
    supplier_proxy_gap,
)

_LARGE_BUDGET = Money(Decimal("999999"), "XXX")
FOUR_HANDS = "Four Hands"
MOES_HOME = "Moes Home"


class Encoder(Protocol):
    def rank(
        self, products: tuple[Product, ...], profile: Profile
    ) -> tuple[RankedCandidate, ...]: ...


def load_products(workbook_path: str) -> dict[str, Product]:
    importer = XlsxCatalogueImporter()
    products: dict[str, Product] = {}
    for supplier in (FOUR_HANDS, MOES_HOME):
        snapshot = importer.import_catalogue(
            source_uri=workbook_path, supplier_id=supplier
        )
        for product in snapshot.products:
            products[product.product_id] = product
    return products


def profile_for_brief(brief: Brief) -> Profile:
    budget = (
        Money(brief.budget_max, "XXX")
        if brief.budget_max is not None
        else _LARGE_BUDGET
    )
    return Profile(
        profile_id=brief.brief_id,
        room_type=brief.room_type,
        style=brief.style or "unspecified",
        atmosphere=brief.atmosphere or "unspecified",
        categories=brief.categories,
        budget=budget,
    )


@dataclass(frozen=True, slots=True)
class ArmResult:
    arm: str
    brief_id: str
    status: str  # "ok" | "not_run"
    not_run_reason: str | None
    precision_at_5: float | None
    ndcg_at_5: float | None
    per_supplier_precision_at_5: dict[str, float]
    n_labelled_candidates: int
    n_positive: int
    shuffled_precision_at_5: float | None


def not_run_result(
    arm: str, brief: Brief, candidate_set: CandidateSet, reason: str
) -> ArmResult:
    return ArmResult(
        arm=arm,
        brief_id=brief.brief_id,
        status="not_run",
        not_run_reason=reason,
        precision_at_5=None,
        ndcg_at_5=None,
        per_supplier_precision_at_5={},
        n_labelled_candidates=len(candidate_set.products),
        n_positive=sum(1 for g in candidate_set.labels.values() if g >= 1),
        shuffled_precision_at_5=None,
    )


def evaluate_arm(
    arm: str,
    encoder: Encoder,
    brief: Brief,
    candidate_set: CandidateSet,
    *,
    shuffle_seed: int,
) -> ArmResult:
    profile = profile_for_brief(brief)
    ranked = encoder.rank(candidate_set.products, profile)

    grades_in_rank_order = [candidate_set.labels[c.product_id] for c in ranked]
    all_grades = list(candidate_set.labels.values())
    p5 = precision_at_k(grades_in_rank_order, k=K)
    ndcg5 = ndcg_at_k(grades_in_rank_order, all_grades, k=K)

    per_supplier: dict[str, float] = {}
    for supplier in set(candidate_set.suppliers.values()):
        supplier_grades = [
            candidate_set.labels[c.product_id]
            for c in ranked
            if candidate_set.suppliers.get(c.product_id) == supplier
        ]
        per_supplier[supplier] = precision_at_k(supplier_grades, k=K)

    product_ids = [c.product_id for c in ranked]
    grades = [candidate_set.labels[pid] for pid in product_ids]
    shuffled = shuffled_labels(product_ids, grades, seed=shuffle_seed)
    shuffled_in_rank_order = [shuffled[pid] for pid in product_ids]
    shuffled_p5 = precision_at_k(shuffled_in_rank_order, k=K)

    return ArmResult(
        arm=arm,
        brief_id=brief.brief_id,
        status="ok",
        not_run_reason=None,
        precision_at_5=p5,
        ndcg_at_5=ndcg5,
        per_supplier_precision_at_5=per_supplier,
        n_labelled_candidates=len(candidate_set.products),
        n_positive=sum(1 for g in all_grades if g >= 1),
        shuffled_precision_at_5=shuffled_p5,
    )


def prevalence_arm(candidate_set: CandidateSet) -> PrevalenceBaseline:
    ordered = [
        (p.product_id, candidate_set.labels[p.product_id])
        for p in candidate_set.products
    ]
    return prevalence_baseline(ordered, k=K)


def supplier_proxy_guard_for_brief(candidate_set: CandidateSet) -> float | None:
    pool_suppliers = list(candidate_set.suppliers.values())
    positive_ids = [pid for pid, g in candidate_set.labels.items() if g >= 1]
    positive_suppliers = [candidate_set.suppliers[pid] for pid in positive_ids]
    return supplier_proxy_gap(
        positive_suppliers, pool_suppliers, four_hands_label=FOUR_HANDS
    )
