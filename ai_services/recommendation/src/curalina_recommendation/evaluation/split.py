"""§D5 step 6: mechanical dev/held-out split by `sha256(brief_id)`, never
by hand. Within each stratum, sort by `sha256(brief_id)` and take
`ceil(n/3)` as held-out — yielding 3 of 9 (A), 2 of 4 (B), 1 of 3 (C):
6 held-out, 10 dev, every stratum represented on both sides.
"""

from __future__ import annotations

import hashlib
import math
from dataclasses import dataclass

from curalina_recommendation.evaluation.label_rules import Brief


@dataclass(frozen=True, slots=True)
class Split:
    dev_brief_ids: tuple[str, ...]
    held_out_brief_ids: tuple[str, ...]


def _digest(brief_id: str) -> str:
    return hashlib.sha256(brief_id.encode("utf-8")).hexdigest()


def compute_split(briefs: list[Brief]) -> Split:
    dev: list[str] = []
    held_out: list[str] = []
    by_stratum: dict[str, list[Brief]] = {}
    for brief in briefs:
        by_stratum.setdefault(brief.stratum, []).append(brief)
    for stratum in sorted(by_stratum):
        ordered = sorted(by_stratum[stratum], key=lambda b: _digest(b.brief_id))
        n_held = math.ceil(len(ordered) / 3)
        held_out.extend(b.brief_id for b in ordered[:n_held])
        dev.extend(b.brief_id for b in ordered[n_held:])
    return Split(dev_brief_ids=tuple(dev), held_out_brief_ids=tuple(held_out))
