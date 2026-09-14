"""§D5 freeze protocol: write `FREEZE_v1.json` recording the sha256 of
every frozen artifact plus the pinned workbook md5, git SHA and UTC
timestamp — computed and written *before* any `FeatureEncoder` adapter is
constructed or run. §D5 step 9: re-run and recompute all hashes; fail
loudly on any mismatch.
"""

from __future__ import annotations

import hashlib
import json
import subprocess
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path


class FreezeMismatchError(RuntimeError):
    """Raised when a frozen artifact's recomputed hash does not match
    `FREEZE_v1.json`. Per §D5 step 9/D1: a run that cannot prove the freeze
    predates the encoders is `insufficient_evidence`, not a weaker result.
    """


def _sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    digest.update(path.read_bytes())
    return digest.hexdigest()


def _git_sha() -> str:
    result = subprocess.run(
        ["git", "rev-parse", "HEAD"], capture_output=True, text=True, check=False
    )
    return result.stdout.strip() or "uncommitted"


@dataclass(frozen=True, slots=True)
class FreezeRecord:
    files: dict[str, str]
    workbook_md5: str
    git_sha: str
    timestamp_utc: str

    def to_dict(self) -> dict[str, object]:
        return {
            "files": self.files,
            "workbook_md5": self.workbook_md5,
            "git_sha": self.git_sha,
            "timestamp_utc": self.timestamp_utc,
        }


FROZEN_FILENAMES = (
    "vocabulary_map_v1.yaml",
    "briefs_v1.json",
    "label_rules_v1.yaml",
    "relevance_labels_v1.csv",
)


def write_freeze(eval_dir: Path, *, workbook_md5: str) -> FreezeRecord:
    files = {name: _sha256_file(eval_dir / name) for name in FROZEN_FILENAMES}
    record = FreezeRecord(
        files=files,
        workbook_md5=workbook_md5,
        git_sha=_git_sha(),
        timestamp_utc=datetime.now(UTC).isoformat(),
    )
    (eval_dir / "FREEZE_v1.json").write_text(json.dumps(record.to_dict(), indent=2))
    return record


def verify_freeze(eval_dir: Path, *, workbook_md5: str) -> FreezeRecord:
    """Recompute all hashes and raise `FreezeMismatchError` on any mismatch
    (§D5 step 9). Returns the loaded record on success."""

    freeze_path = eval_dir / "FREEZE_v1.json"
    if not freeze_path.exists():
        raise FreezeMismatchError(
            f"{freeze_path} does not exist — freeze was never written"
        )
    recorded = json.loads(freeze_path.read_text())
    mismatches: list[str] = []
    for name in FROZEN_FILENAMES:
        actual = _sha256_file(eval_dir / name)
        expected = recorded["files"].get(name)
        if actual != expected:
            mismatches.append(f"{name}: expected {expected}, got {actual}")
    if recorded.get("workbook_md5") != workbook_md5:
        mismatches.append(
            f"workbook_md5: expected {recorded.get('workbook_md5')}, got {workbook_md5}"
        )
    if mismatches:
        raise FreezeMismatchError(
            "FREEZE_v1.json hash mismatch — run is insufficient_evidence "
            "per §D5 step 9: " + "; ".join(mismatches)
        )
    return FreezeRecord(
        files=dict(recorded["files"]),
        workbook_md5=recorded["workbook_md5"],
        git_sha=recorded["git_sha"],
        timestamp_utc=recorded["timestamp_utc"],
    )
