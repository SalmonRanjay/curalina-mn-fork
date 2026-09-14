"""`TfidfEncoder` — TF-IDF cosine-similarity baseline over `name` +
`overview` text against a `style atmosphere` query string.

`scikit-learn` is an `eval`-extra dependency (ADR-0006 §D7): it is never
imported at module load time so `make test` stays green with the extra
absent — the import happens lazily inside `rank`.
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass

from curalina_recommendation.domain.eligibility import EligibilityReason
from curalina_recommendation.domain.product import Product
from curalina_recommendation.domain.profile import Profile
from curalina_recommendation.domain.ranking import RankedCandidate


class SklearnUnavailableError(RuntimeError):
    """Raised when `scikit-learn` is not installed. Callers must record
    the arm as `not_run`, never as a loss (ADR-0006 §D7)."""


def _encoder_text(product: Product) -> str:
    parts = [product.name]
    if product.overview:
        parts.append(product.overview)
    return " ".join(parts)


def _query_text(profile: Profile) -> str:
    return f"{profile.style} {profile.atmosphere}"


@dataclass(frozen=True, slots=True)
class TfidfEncoder:
    def rank(
        self, products: Sequence[Product], profile: Profile
    ) -> tuple[RankedCandidate, ...]:
        try:
            from sklearn.feature_extraction.text import TfidfVectorizer
            from sklearn.metrics.pairwise import cosine_similarity
        except ImportError as exc:
            raise SklearnUnavailableError(
                "scikit-learn is not installed; install the 'eval' extra"
            ) from exc

        corpus = [_encoder_text(p) for p in products]
        query = _query_text(profile)
        vectorizer = TfidfVectorizer()
        matrix = vectorizer.fit_transform([*corpus, query])
        doc_matrix, query_vec = matrix[:-1], matrix[-1]
        similarities = cosine_similarity(doc_matrix, query_vec).ravel()

        candidates = []
        for product, score in zip(products, similarities, strict=True):
            clipped = float(max(0.0, min(1.0, score)))
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
