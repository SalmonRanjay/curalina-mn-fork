"""`RankedCandidate` — one scored product returned by a `FeatureEncoder`.

This is the typed output shape both the eventual rule-only ranking
(workflow step 3, blocked on R02) and the eventual MiniLM embedding
ranking (step 4, blocked on R02's held-out gate) must produce; today only
`FakeFeatureEncoder` produces it.
"""

from __future__ import annotations

from dataclasses import dataclass

from curalina_recommendation.domain.eligibility import EligibilityReason


@dataclass(frozen=True, slots=True)
class RankedCandidate:
    """One product scored against a `Profile`.

    `score` is a closed `[0.0, 1.0]` range; `reasons` is a closed,
    typed vocabulary (`EligibilityReason`), never a free-text explanation.
    """

    product_id: str
    category: str
    score: float
    reasons: tuple[EligibilityReason, ...]

    def __post_init__(self) -> None:
        if not 0.0 <= self.score <= 1.0:
            raise ValueError(f"score must be in [0.0, 1.0], got {self.score}")
