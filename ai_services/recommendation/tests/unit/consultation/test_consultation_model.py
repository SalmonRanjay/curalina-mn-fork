import json
from importlib import resources
from pathlib import Path

import numpy as np
import pytest

from curalina_recommendation.consultation.model import TwoTowerScorer


def _parity() -> dict[str, object]:
    text = (
        resources.files("curalina_recommendation.consultation")
        .joinpath("model/parity.json")
        .read_text(encoding="utf-8")
    )
    return json.loads(text)  # type: ignore[no-any-return]


def test_numpy_forward_pass_reproduces_the_pytorch_logits() -> None:
    scorer = TwoTowerScorer.load()
    vectors = _parity()["vectors"]
    assert isinstance(vectors, list) and len(vectors) == 32
    q = np.asarray([v["query"] for v in vectors], dtype=np.float32)
    p = np.asarray([v["product"] for v in vectors], dtype=np.float32)
    expected = np.asarray([v["logit"] for v in vectors], dtype=np.float32)
    np.testing.assert_allclose(scorer.logits(q, p), expected, atol=1e-4)


def test_packaged_artifact_identity() -> None:
    info = TwoTowerScorer.load().info
    assert info.family == "consultation-two-tower"
    assert info.trained_run == "run_20260930T233410"
    assert len(info.weights_sha256) == 64


def test_weights_that_do_not_match_the_manifest_are_refused(tmp_path: Path) -> None:
    root = resources.files("curalina_recommendation.consultation").joinpath("model")
    for name in ("model_weights.npz", "feature_space.json", "metrics.json"):
        (tmp_path / name).write_bytes(root.joinpath(name).read_bytes())
    (tmp_path / "manifest.json").write_text(json.dumps({"weights_sha256": "0" * 64}))
    with pytest.raises(ValueError, match="manifest"):
        TwoTowerScorer.load(tmp_path)
