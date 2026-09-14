"""Orchestrates the §D5 freeze protocol and R02's load path. Notebook
cells call only these functions — no business logic in the notebook
itself (`agentic_flow/16_notebook_standard.md`).
"""

from __future__ import annotations

import csv
import json
from dataclasses import dataclass
from pathlib import Path

import yaml

from curalina_recommendation.adapters.xlsx_workbook_reader import file_md5
from curalina_recommendation.evaluation import freeze as freeze_mod
from curalina_recommendation.evaluation.briefs import (
    brief_from_dict,
    brief_to_dict,
    build_stratum_a,
    build_stratum_b,
    build_stratum_c,
)
from curalina_recommendation.evaluation.label_rules import (
    Brief,
    LabelResult,
    label_product,
)
from curalina_recommendation.evaluation.label_source import (
    LabelSourceRecord,
    read_label_source_records,
)
from curalina_recommendation.evaluation.pool_selection import CellDiagnostic
from curalina_recommendation.evaluation.split import Split, compute_split
from curalina_recommendation.evaluation.vocabulary import VocabularyMap
from curalina_recommendation.evaluation.vocabulary_build import build_vocabulary_map

LABEL_ROW_FIELDS = (
    "brief_id",
    "product_id",
    "supplier_id",
    "precondition",
    "grade",
    "unmapped",
    "partial_normalization",
)


@dataclass(frozen=True, slots=True)
class FrozenFixtures:
    vocabulary_map: VocabularyMap
    briefs: list[Brief]
    label_results_by_brief: dict[str, list[LabelResult]]
    diagnostics_by_pool: dict[str, list[CellDiagnostic]]
    split: Split


def _label_rows_to_results(rows: list[dict[str, str]]) -> dict[str, list[LabelResult]]:
    out: dict[str, list[LabelResult]] = {}
    for row in rows:
        result = LabelResult(
            product_id=row["product_id"],
            supplier_id=row["supplier_id"],
            precondition=row["precondition"] == "True",
            grade=int(row["grade"]) if row["grade"] not in ("", "None") else None,
            unmapped=row["unmapped"] == "True",
            partial_normalization=row["partial_normalization"] == "True",
        )
        out.setdefault(row["brief_id"], []).append(result)
    return out


def author_frozen_fixtures(
    eval_dir: Path, *, workbook_path: str, mapper_path: str
) -> FrozenFixtures:
    """§D5 steps 1-7. Must run, and its output must be written to disk,
    before any `FeatureEncoder` adapter is constructed or run (step 8)."""

    eval_dir.mkdir(parents=True, exist_ok=True)

    vocab = build_vocabulary_map(mapper_path)
    (eval_dir / "vocabulary_map_v1.yaml").write_text(
        yaml.safe_dump(vocab.to_dict(), sort_keys=True)
    )

    records: tuple[LabelSourceRecord, ...] = read_label_source_records(workbook_path)

    stratum_a, diagnostics_by_pool = build_stratum_a(records, vocab)
    stratum_b = build_stratum_b(records)
    stratum_c = build_stratum_c()
    briefs = stratum_a + stratum_b + stratum_c
    (eval_dir / "briefs_v1.json").write_text(
        json.dumps([brief_to_dict(b) for b in briefs], indent=2, default=str)
    )

    label_rules_config = {
        "version": "v1",
        "grades": {"strong": 2, "acceptable": 1, "none": 0},
        "coverage_guard_max_unmapped_rate": 0.15,
        "layer1_min_eligible_a_and_b": 20,
    }
    (eval_dir / "label_rules_v1.yaml").write_text(
        yaml.safe_dump(label_rules_config, sort_keys=True)
    )

    label_results_by_brief: dict[str, list[LabelResult]] = {}
    label_rows: list[dict[str, object]] = []
    for brief in briefs:
        results = [label_product(brief, record, vocab) for record in records]
        label_results_by_brief[brief.brief_id] = results
        for result in results:
            label_rows.append(
                {
                    "brief_id": brief.brief_id,
                    "product_id": result.product_id,
                    "supplier_id": result.supplier_id,
                    "precondition": result.precondition,
                    "grade": result.grade if result.grade is not None else "",
                    "unmapped": result.unmapped,
                    "partial_normalization": result.partial_normalization,
                }
            )
    with (eval_dir / "relevance_labels_v1.csv").open("w", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(LABEL_ROW_FIELDS))
        writer.writeheader()
        writer.writerows(label_rows)

    split = compute_split(briefs)

    freeze_mod.write_freeze(eval_dir, workbook_md5=file_md5(workbook_path))

    return FrozenFixtures(
        vocabulary_map=vocab,
        briefs=briefs,
        label_results_by_brief=label_results_by_brief,
        diagnostics_by_pool=diagnostics_by_pool,
        split=split,
    )


def load_frozen_fixtures(eval_dir: Path, *, workbook_path: str) -> FrozenFixtures:
    """§D5 step 9: recompute and verify every hash before loading. Raises
    `freeze.FreezeMismatchError` on any mismatch."""

    freeze_mod.verify_freeze(eval_dir, workbook_md5=file_md5(workbook_path))

    vocab = VocabularyMap.from_dict(
        yaml.safe_load((eval_dir / "vocabulary_map_v1.yaml").read_text())
    )
    briefs = [
        brief_from_dict(d)
        for d in json.loads((eval_dir / "briefs_v1.json").read_text())
    ]
    with (eval_dir / "relevance_labels_v1.csv").open() as handle:
        rows = list(csv.DictReader(handle))
    label_results_by_brief = _label_rows_to_results(rows)
    split = compute_split(briefs)
    return FrozenFixtures(
        vocabulary_map=vocab,
        briefs=briefs,
        label_results_by_brief=label_results_by_brief,
        diagnostics_by_pool={},
        split=split,
    )
