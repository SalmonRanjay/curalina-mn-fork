"""§D5 freeze-protocol orchestration (`author_frozen_fixtures`/
`load_frozen_fixtures`), exercised against stubbed collaborators so this
stays a fast unit test of the orchestration logic — not an integration
test against the real pinned workbook (that is the notebook's job)."""

from __future__ import annotations

from pathlib import Path

import pytest

from curalina_recommendation.evaluation import pipeline
from curalina_recommendation.evaluation.briefs import CellDiagnostic
from curalina_recommendation.evaluation.freeze import FreezeMismatchError
from curalina_recommendation.evaluation.label_rules import Brief, LabelResult
from curalina_recommendation.evaluation.label_source import LabelSourceRecord
from curalina_recommendation.evaluation.vocabulary import VocabularyMap

_WORKBOOK_MD5 = "fake-workbook-md5"


def _vocab() -> VocabularyMap:
    return VocabularyMap(
        canonical_styles=("Modern Farmhouse",),
        canonical_tags=("Warm Neutrals",),
        canonical_rooms=("Dining room",),
        material_family_tags=(),
        tag_reference={},
        style_synonyms={},
        style_out_of_axis={},
        tag_synonyms={},
        tag_out_of_axis={},
        room_synonyms={},
    )


def _record(product_id: str) -> LabelSourceRecord:
    return LabelSourceRecord(
        product_id=product_id,
        supplier_id="Four Hands",
        price=None,
        width_in=None,
        room_types_raw=("Dining room",),
        design_styles_raw=("Modern Farmhouse",),
        tags_raw=("Warm Neutrals",),
        categories_raw=("Dining Chairs",),
    )


def _stub_brief() -> Brief:
    return Brief(
        brief_id="A1-1",
        stratum="A",
        room_type="Dining room",
        categories=("Dining Chairs",),
        style="Modern Farmhouse",
        atmosphere="Warm Neutrals",
    )


def _patch_common_collaborators(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(pipeline, "build_vocabulary_map", lambda mapper_path: _vocab())
    monkeypatch.setattr(
        pipeline,
        "read_label_source_records",
        lambda workbook_path: (_record("p1"), _record("p2")),
    )
    monkeypatch.setattr(
        pipeline,
        "build_stratum_a",
        lambda records, vocab: ([_stub_brief()], {"A1": [_diag()]}),
    )
    monkeypatch.setattr(pipeline, "build_stratum_b", lambda records: [])
    monkeypatch.setattr(pipeline, "build_stratum_c", lambda: [])
    monkeypatch.setattr(pipeline, "file_md5", lambda path: _WORKBOOK_MD5)


def _diag() -> CellDiagnostic:
    return CellDiagnostic(
        pool_id="A1",
        style="Modern Farmhouse",
        atmosphere="Warm Neutrals",
        pool_size=20,
        positives=10,
        grade2=3,
        r_union=0.5,
        r_grade2=0.15,
        jaccard_style_tag=0.1,
        fh_share_pool=1.0,
        fh_share_positive=1.0,
        guards_failed=(),
    )


def test_author_frozen_fixtures_writes_all_five_frozen_files(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    _patch_common_collaborators(monkeypatch)

    pipeline.author_frozen_fixtures(
        tmp_path, workbook_path="fake.xlsx", mapper_path="fake_mapper.xlsx"
    )

    for name in (
        "vocabulary_map_v1.yaml",
        "briefs_v1.json",
        "label_rules_v1.yaml",
        "relevance_labels_v1.csv",
        "FREEZE_v1.json",
    ):
        assert (tmp_path / name).exists(), f"{name} was not written"


def test_author_frozen_fixtures_returns_briefs_and_label_results_for_each_brief(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    _patch_common_collaborators(monkeypatch)

    fixtures = pipeline.author_frozen_fixtures(
        tmp_path, workbook_path="fake.xlsx", mapper_path="fake_mapper.xlsx"
    )

    assert [b.brief_id for b in fixtures.briefs] == ["A1-1"]
    assert "A1-1" in fixtures.label_results_by_brief
    # Two synthetic records -> two label results computed for the brief.
    assert len(fixtures.label_results_by_brief["A1-1"]) == 2
    assert fixtures.diagnostics_by_pool == {"A1": [_diag()]}


def test_author_frozen_fixtures_labels_matching_products_as_grade_2(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    _patch_common_collaborators(monkeypatch)

    fixtures = pipeline.author_frozen_fixtures(
        tmp_path, workbook_path="fake.xlsx", mapper_path="fake_mapper.xlsx"
    )

    results = fixtures.label_results_by_brief["A1-1"]
    assert all(isinstance(r, LabelResult) for r in results)
    # Both synthetic records match style + atmosphere exactly -> grade 2.
    assert {r.product_id: r.grade for r in results} == {"p1": 2, "p2": 2}


def test_author_frozen_fixtures_computes_a_split_covering_the_stub_brief(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    _patch_common_collaborators(monkeypatch)

    fixtures = pipeline.author_frozen_fixtures(
        tmp_path, workbook_path="fake.xlsx", mapper_path="fake_mapper.xlsx"
    )

    assert set(fixtures.split.dev_brief_ids) | set(
        fixtures.split.held_out_brief_ids
    ) == {"A1-1"}


def test_author_then_load_round_trip_preserves_vocabulary_and_briefs(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    _patch_common_collaborators(monkeypatch)

    authored = pipeline.author_frozen_fixtures(
        tmp_path, workbook_path="fake.xlsx", mapper_path="fake_mapper.xlsx"
    )

    monkeypatch.setattr(pipeline, "file_md5", lambda path: _WORKBOOK_MD5)
    loaded = pipeline.load_frozen_fixtures(tmp_path, workbook_path="fake.xlsx")

    assert loaded.vocabulary_map == authored.vocabulary_map
    assert loaded.briefs == authored.briefs
    assert loaded.label_results_by_brief == authored.label_results_by_brief
    # load_frozen_fixtures deliberately does not reload per-pool
    # diagnostics (§D5 step 9 only re-verifies the frozen artifacts).
    assert loaded.diagnostics_by_pool == {}


def test_load_frozen_fixtures_raises_loudly_when_a_frozen_file_changed_after_freeze(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    _patch_common_collaborators(monkeypatch)
    pipeline.author_frozen_fixtures(
        tmp_path, workbook_path="fake.xlsx", mapper_path="fake_mapper.xlsx"
    )

    (tmp_path / "briefs_v1.json").write_text("[]")
    monkeypatch.setattr(pipeline, "file_md5", lambda path: _WORKBOOK_MD5)

    with pytest.raises(FreezeMismatchError):
        pipeline.load_frozen_fixtures(tmp_path, workbook_path="fake.xlsx")


def test_load_frozen_fixtures_raises_loudly_when_the_workbook_changed(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    _patch_common_collaborators(monkeypatch)
    pipeline.author_frozen_fixtures(
        tmp_path, workbook_path="fake.xlsx", mapper_path="fake_mapper.xlsx"
    )

    monkeypatch.setattr(pipeline, "file_md5", lambda path: "a-different-md5")

    with pytest.raises(FreezeMismatchError):
        pipeline.load_frozen_fixtures(tmp_path, workbook_path="fake.xlsx")


def test_author_frozen_fixtures_label_rows_use_empty_string_for_none_grade(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    _patch_common_collaborators(monkeypatch)
    # A record whose style token is wholly unresolvable against the vocab
    # (no canonical hit at all) -> the style axis is UNMAPPED per §D4a, so
    # `label_product` returns grade=None, which the CSV writer must
    # serialize as an empty string, not the literal "None".
    unresolvable_record = LabelSourceRecord(
        product_id="p_unresolvable",
        supplier_id="Four Hands",
        price=None,
        width_in=None,
        room_types_raw=("Dining room",),
        design_styles_raw=("Nonexistent Style Nobody Authored",),
        tags_raw=("Warm Neutrals",),
        categories_raw=("Dining Chairs",),
    )
    monkeypatch.setattr(
        pipeline,
        "read_label_source_records",
        lambda workbook_path: (unresolvable_record,),
    )

    pipeline.author_frozen_fixtures(
        tmp_path, workbook_path="fake.xlsx", mapper_path="fake_mapper.xlsx"
    )

    csv_text = (tmp_path / "relevance_labels_v1.csv").read_text()
    lines = csv_text.strip().splitlines()
    assert len(lines) == 2  # header + 1 record
    fields = lines[1].split(",")
    grade_field = fields[4]
    unmapped_field = fields[5]
    assert grade_field == ""  # unmapped -> grade serializes as empty, never "None"
    assert unmapped_field == "True"
