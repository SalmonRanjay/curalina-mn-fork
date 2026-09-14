"""`MiniLMEncoder` — sentence-embedding similarity baseline over `name` +
`overview` text against a `style atmosphere` query string.

`sentence-transformers` is an `eval`-extra dependency (ADR-0006 §D7): it is
never imported at module load time so `make test` stays green with the
extra absent — the import happens lazily inside `rank`. `revision` is
pinned to a commit SHA (never a branch); weights cache to a gitignored
`model_cache/` by default. Not accepted as a path per ADR-0006 §D6 —
this class exists to *measure*, not to be adopted, on this run.
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass

from curalina_recommendation.domain.eligibility import EligibilityReason
from curalina_recommendation.domain.product import Product
from curalina_recommendation.domain.profile import Profile
from curalina_recommendation.domain.ranking import RankedCandidate

MODEL_ID = "sentence-transformers/all-MiniLM-L6-v2"
# Pinned commit SHA, never a branch name, per ADR-0006 §D7.
MODEL_REVISION = "8b3219a92973c328a8e22fadcfa821b5dc75636a"
DEFAULT_CACHE_DIR = "model_cache"


class SentenceTransformersUnavailableError(RuntimeError):
    """Raised when `sentence-transformers` is not installed, or its
    weights cannot be loaded/downloaded (no network, incompatible
    runtime, etc.). Callers must record the arm as `not_run` with the
    actual reason, never as a loss (ADR-0006 §D7)."""


def _encoder_text(product: Product) -> str:
    parts = [product.name]
    if product.overview:
        parts.append(product.overview)
    return " ".join(parts)


@dataclass(frozen=True, slots=True)
class MiniLMEncoder:
    cache_dir: str = DEFAULT_CACHE_DIR
    revision: str = MODEL_REVISION

    def rank(
        self, products: Sequence[Product], profile: Profile
    ) -> tuple[RankedCandidate, ...]:
        try:
            from sentence_transformers import SentenceTransformer, util
        except ImportError as exc:
            raise SentenceTransformersUnavailableError(
                "sentence-transformers is not installed; install the 'eval' extra"
            ) from exc
        try:
            model = SentenceTransformer(
                MODEL_ID, revision=self.revision, cache_folder=self.cache_dir
            )
        except Exception as exc:  # noqa: BLE001 - any load/network failure -> not_run
            raise SentenceTransformersUnavailableError(
                f"could not load {MODEL_ID}@{self.revision}: {exc}"
            ) from exc

        corpus = [_encoder_text(p) for p in products]
        query = f"{profile.style} {profile.atmosphere}"
        doc_embeddings = model.encode(corpus, convert_to_tensor=True)
        query_embedding = model.encode(query, convert_to_tensor=True)
        similarities = util.cos_sim(query_embedding, doc_embeddings).flatten().tolist()

        candidates = []
        for product, score in zip(products, similarities, strict=True):
            clipped = float(max(0.0, min(1.0, (score + 1) / 2)))
            reasons = (
                (EligibilityReason.CATEGORY_MATCH,)
                if product.category in profile.categories
                else (EligibilityReason.CATEGORY_NOT_REQUESTED,)
            )
            candidates.append(
                RankedCandidate(
                    product_id=product.product_id,
                    category=product.category,
                    score=clipped,
                    reasons=reasons,
                )
            )

        def _sort_key(c: RankedCandidate) -> tuple[float, str]:
            return (-c.score, c.product_id)

        return tuple(sorted(candidates, key=_sort_key))
