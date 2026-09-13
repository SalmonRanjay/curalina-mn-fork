"""`FeatureEncoder` port.

Future home of workflow steps 3 and 4 from
`agentic_flow/recommendation_workflow.md`'s A2 sequence:

- Step 3, rule-only ranking with deterministic tie-breaking, depends on
  R02's fixed baseline. R02 has not been run — no real rule-only adapter
  exists yet.
- Step 4, MiniLM embedding-based ranking, is a *second* implementation of
  this same port, wired in as accepted only once R02's held-out gate is
  met and an ADR records the decision (per the gate table in
  `agentic_flow/recommendation_workflow.md`). Caching is by content hash
  plus encoder revision.

Only `adapters.fake_feature_encoder.FakeFeatureEncoder` implements this
port today, and it performs no ranking logic at all.
"""

from __future__ import annotations

from collections.abc import Sequence
from typing import Protocol

from curalina_recommendation.domain.product import Product
from curalina_recommendation.domain.profile import Profile
from curalina_recommendation.domain.ranking import RankedCandidate


class FeatureEncoder(Protocol):
    """Scores candidate products against a design profile."""

    def rank(
        self, products: Sequence[Product], profile: Profile
    ) -> tuple[RankedCandidate, ...]:
        """Return every candidate in `products` scored against `profile`.

        Real rule-only implementation: deterministic rule weights over
        category/style/atmosphere match, ties broken by `product_id`
        ascending (blocked on R02). Real embedding implementation: MiniLM
        vector similarity, cached by content hash + encoder revision,
        accepted only after the R02 held-out gate and ADR (blocked on
        R02's gate, not merely its baseline run). Neither exists yet.
        """
        ...
