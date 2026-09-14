"""§D5 step 9: freeze-file hash-mismatch must fail loudly."""

from __future__ import annotations

from pathlib import Path

import pytest

from curalina_recommendation.evaluation.freeze import (
    FreezeMismatchError,
    verify_freeze,
    write_freeze,
)


def _write_fixtures(eval_dir: Path) -> None:
    eval_dir.mkdir(parents=True, exist_ok=True)
    (eval_dir / "vocabulary_map_v1.yaml").write_text("a: 1\n")
    (eval_dir / "briefs_v1.json").write_text("[]")
    (eval_dir / "label_rules_v1.yaml").write_text("version: v1\n")
    (eval_dir / "relevance_labels_v1.csv").write_text("brief_id,product_id\n")


def test_verify_freeze_succeeds_when_nothing_changed(tmp_path: Path) -> None:
    _write_fixtures(tmp_path)
    write_freeze(tmp_path, workbook_md5="abc123")

    record = verify_freeze(tmp_path, workbook_md5="abc123")

    assert record.workbook_md5 == "abc123"


def test_verify_freeze_fails_loudly_on_file_content_change(tmp_path: Path) -> None:
    _write_fixtures(tmp_path)
    write_freeze(tmp_path, workbook_md5="abc123")

    (tmp_path / "briefs_v1.json").write_text('[{"changed": true}]')

    with pytest.raises(FreezeMismatchError):
        verify_freeze(tmp_path, workbook_md5="abc123")


def test_verify_freeze_fails_loudly_on_workbook_md5_change(tmp_path: Path) -> None:
    _write_fixtures(tmp_path)
    write_freeze(tmp_path, workbook_md5="abc123")

    with pytest.raises(FreezeMismatchError):
        verify_freeze(tmp_path, workbook_md5="a-different-workbook")


def test_verify_freeze_fails_when_never_written(tmp_path: Path) -> None:
    _write_fixtures(tmp_path)

    with pytest.raises(FreezeMismatchError):
        verify_freeze(tmp_path, workbook_md5="abc123")
