"""Numpy inference for the trained two-tower consultation model.

The weights (`model/model_weights.npz`) and feature layout
(`model/feature_space.json`) are exported by
`notebooks/learning/pytorch_recommendation_matching_demo.ipynb` section 9.
Running the forward pass in numpy keeps PyTorch out of the service image;
`tests/unit/consultation/test_model.py` checks it reproduces the notebook's
PyTorch logits on the exported `parity.json` vectors.

Architecture (notebook section 5): a query tower and a product tower
(Linear -> ReLU -> Linear, 32-d each) plus 12 explicit overlap features,
scored by a head over `[query, product, query * product, overlaps]`.
"""

from __future__ import annotations

import hashlib
import io
import json
import math
from collections.abc import Sequence
from dataclasses import dataclass
from importlib import resources
from pathlib import Path
from typing import Any

import numpy as np
import numpy.typing as npt

from curalina_recommendation.consultation.catalogue import CatalogueProduct
from curalina_recommendation.consultation.quiz import Query

FloatArray = npt.NDArray[np.float32]

MODEL_FAMILY = "consultation-two-tower"
_NUMERIC_COLUMNS = ("price", "width_in", "depth_in", "height_in")


def _one_hot(vocab: Sequence[str], values: Sequence[str]) -> FloatArray:
    vector = np.zeros(len(vocab), dtype=np.float32)
    for value in values:
        if value in vocab:
            vector[vocab.index(value)] = 1.0
    return vector


@dataclass(frozen=True)
class FeatureSpace:
    query_vocab: dict[str, list[str]]
    product_vocab: dict[str, list[str]]
    numeric: dict[str, dict[str, float]]
    overlap_pairs: list[list[tuple[int, int]]]
    presence: dict[str, list[int]]
    query_dim: int
    product_dim: int

    @classmethod
    def from_json(cls, data: dict[str, Any]) -> FeatureSpace:
        return cls(
            query_vocab=data["query_vocab"],
            product_vocab=data["product_vocab"],
            numeric=data["numeric"],
            overlap_pairs=[
                [(int(a), int(b)) for a, b in pairs] for pairs in data["overlap_pairs"]
            ],
            presence={k: [int(i) for i in v] for k, v in data["presence"].items()},
            query_dim=int(data["query_dim"]),
            product_dim=int(data["product_dim"]),
        )

    def encode_query(self, q: Query) -> FloatArray:
        v = self.query_vocab
        return np.concatenate(
            [
                _one_hot(v["room"], [q.room]),
                _one_hot(v["aesthetic"], [q.aesthetic]),
                _one_hot(v["materiality"], [q.materiality]),
                _one_hot(v["atmosphere"], [q.atmosphere]),
                _one_hot(v["touches"], q.touches),
                _one_hot(
                    v["seating"], [str(q.seating) if q.seating is not None else "none"]
                ),
                _one_hot(v["bed_size"], [q.bed_size or "none"]),
            ]
        )

    def encode_product(self, p: CatalogueProduct) -> FloatArray:
        v = self.product_vocab
        parts = [
            _one_hot(v["rooms"], p.rooms),
            _one_hot(v["styles"], p.styles),
            _one_hot(v["atmospheres"], p.atmospheres),
            _one_hot(v["touches"], p.touches),
            _one_hot(
                v["seating"], [str(p.seating) if p.seating is not None else "none"]
            ),
            _one_hot(v["bed_size"], [p.bed_size or "none"]),
            _one_hot(v["category"], [p.category]),
            _one_hot(v["supplier"], [p.supplier]),
        ]
        numeric: list[float] = []
        raw = {
            "price": p.price,
            "width_in": p.width_in,
            "depth_in": p.depth_in,
            "height_in": p.height_in,
        }
        for column in _NUMERIC_COLUMNS:
            stats = self.numeric[column]
            value = raw[column]
            if value is None:
                numeric += [0.0, 1.0]  # missing flag, never an invented value
            else:
                x = math.log1p(value) if column == "price" else value
                numeric += [(x - stats["mean"]) / stats["std"], 0.0]
        return np.concatenate([*parts, np.asarray(numeric, dtype=np.float32)])


def _relu(x: FloatArray) -> FloatArray:
    return np.maximum(x, 0.0)


@dataclass(frozen=True)
class ModelInfo:
    family: str
    weights_sha256: str
    trained_run: str | None
    test_metrics: dict[str, Any]


class TwoTowerScorer:
    def __init__(
        self, weights: dict[str, FloatArray], features: FeatureSpace, info: ModelInfo
    ) -> None:
        self._w = weights
        self.features = features
        self.info = info

    @classmethod
    def load(cls, model_dir: Path | None = None) -> TwoTowerScorer:
        """`model_dir=None` loads the artifact packaged with this service."""
        if model_dir is None:
            root = resources.files("curalina_recommendation.consultation").joinpath(
                "model"
            )
            weights_bytes = root.joinpath("model_weights.npz").read_bytes()
            feature_json = root.joinpath("feature_space.json").read_text(
                encoding="utf-8"
            )
            metrics_json = root.joinpath("metrics.json").read_text(encoding="utf-8")
            manifest_json = root.joinpath("manifest.json").read_text(encoding="utf-8")
        else:
            weights_bytes = (model_dir / "model_weights.npz").read_bytes()
            feature_json = (model_dir / "feature_space.json").read_text(
                encoding="utf-8"
            )
            metrics_path, manifest_path = (
                model_dir / "metrics.json",
                model_dir / "manifest.json",
            )
            metrics_json = (
                metrics_path.read_text(encoding="utf-8")
                if metrics_path.exists()
                else "{}"
            )
            manifest_json = (
                manifest_path.read_text(encoding="utf-8")
                if manifest_path.exists()
                else "{}"
            )
        with np.load(io.BytesIO(weights_bytes)) as archive:
            weights = {k: archive[k].astype(np.float32) for k in archive.files}
        metrics = json.loads(metrics_json)
        manifest = json.loads(manifest_json)
        sha256 = hashlib.sha256(weights_bytes).hexdigest()
        if manifest.get("weights_sha256") not in (None, sha256):
            raise ValueError(
                "model_weights.npz does not match manifest.json's weights_sha256"
            )
        info = ModelInfo(
            family=MODEL_FAMILY,
            weights_sha256=sha256,
            trained_run=manifest.get("run_id"),
            test_metrics=metrics.get("test", {}),
        )
        return cls(weights, FeatureSpace.from_json(json.loads(feature_json)), info)

    def _linear(self, name: str, x: FloatArray) -> FloatArray:
        out: FloatArray = x @ self._w[f"{name}.weight"].T + self._w[f"{name}.bias"]
        return out

    def _overlaps(self, q: FloatArray, p: FloatArray) -> FloatArray:
        cols: list[FloatArray] = []
        for pairs in self.features.overlap_pairs:
            qi = np.asarray([a for a, _ in pairs], dtype=np.int64)
            pi = np.asarray([b for _, b in pairs], dtype=np.int64)
            cols.append((q[:, qi] * p[:, pi]).sum(axis=1))
        for key, idx in self.features.presence.items():
            side = p if key.startswith("product") else q
            cols.append(
                np.minimum(side[:, np.asarray(idx, dtype=np.int64)].sum(axis=1), 1.0)
            )
        return np.stack(cols, axis=1).astype(np.float32)

    def logits(self, q: FloatArray, p: FloatArray) -> FloatArray:
        """`q` is (n, query_dim), `p` is (n, product_dim); returns (n,) logits."""
        eq = self._linear("query_tower.2", _relu(self._linear("query_tower.0", q)))
        ep = self._linear("product_tower.2", _relu(self._linear("product_tower.0", p)))
        head_in = np.concatenate([eq, ep, eq * ep, self._overlaps(q, p)], axis=1)
        hidden = _relu(self._linear("head.0", head_in))
        out: FloatArray = self._linear("head.2", hidden)[:, 0]
        return out

    def score(self, query: Query, product_matrix: FloatArray) -> FloatArray:
        """Match probability of every product row for one quiz submission."""
        q = np.repeat(
            self.features.encode_query(query)[None, :], len(product_matrix), axis=0
        )
        logits = self.logits(q, product_matrix)
        probability: FloatArray = (1.0 / (1.0 + np.exp(-logits))).astype(np.float32)
        return probability

    def encode_products(self, products: Sequence[CatalogueProduct]) -> FloatArray:
        if not products:
            return np.zeros((0, self.features.product_dim), dtype=np.float32)
        return np.stack([self.features.encode_product(p) for p in products])
