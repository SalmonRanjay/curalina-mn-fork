"""ADR-0006 §D7: `MiniLMEncoder`/`TfidfEncoder` must not import
`sentence-transformers`/`scikit-learn` at module load time, so `make test`
stays green with the `eval` extra absent. This test asserts the encoder
modules import cleanly regardless of whether those packages are installed,
and only fail (with the documented `*UnavailableError`) inside `rank`.
"""

from __future__ import annotations

import importlib
import sys
from decimal import Decimal

import pytest

from curalina_recommendation.adapters import minilm_encoder, tfidf_encoder
from curalina_recommendation.domain.eligibility import Availability
from curalina_recommendation.domain.money import Money
from curalina_recommendation.domain.product import Product, ProductKey
from curalina_recommendation.domain.profile import Profile


def test_tfidf_encoder_module_imports_without_sklearn(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setitem(sys.modules, "sklearn", None)
    importlib.reload(tfidf_encoder)


def test_minilm_encoder_module_imports_without_sentence_transformers(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setitem(sys.modules, "sentence_transformers", None)
    importlib.reload(minilm_encoder)


def _profile() -> Profile:
    return Profile(
        profile_id="p1",
        room_type="Dining room",
        style="Modern Farmhouse",
        atmosphere="Warm Neutrals",
        categories=("Dining Chairs",),
        budget=Money(Decimal("500"), "XXX"),
    )


def _product() -> Product:
    return Product(
        product_id="four-hands:sku-1",
        key=ProductKey.build(supplier_id="Four Hands", raw_sku="SKU-1"),
        category="Dining Chairs",
        name="Test Chair",
        availability=Availability.UNKNOWN,
        overview="A chair.",
    )


def test_tfidf_encoder_raises_documented_error_when_sklearn_absent() -> None:
    if "sklearn" in sys.modules and sys.modules.get("sklearn") is not None:
        pytest.skip("scikit-learn is installed in this environment")
    encoder = tfidf_encoder.TfidfEncoder()
    with pytest.raises(tfidf_encoder.SklearnUnavailableError):
        encoder.rank((_product(),), _profile())


def test_minilm_encoder_raises_documented_error_when_unavailable() -> None:
    if "sentence_transformers" in sys.modules and sys.modules.get(
        "sentence_transformers"
    ) is not None:
        pytest.skip("sentence-transformers is installed in this environment")
    encoder = minilm_encoder.MiniLMEncoder()
    with pytest.raises(minilm_encoder.SentenceTransformersUnavailableError):
        encoder.rank((_product(),), _profile())
