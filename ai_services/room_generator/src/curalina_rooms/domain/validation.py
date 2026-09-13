"""Post-render validation result types.

Per `agentic_flow/14_room_generation_technical_design.md`'s
`InstanceValidation` sketch and `architecture/guides/06_room_generation.md`
("Record absent, extra, wrong identity, wrong colour, distorted geometry,
implausible scale and altered architecture separately"), every failure mode
is its own field/verdict, never merged into one score.

These are **typed results only** — no real identity/colour/geometry check
is implemented yet. `Verdict.NOT_EVALUATED` is the honest state a fake or
not-yet-built checker must return: it is a distinct value from `PASS`
specifically so nothing here can be mistaken for evidence that grounding
was verified. `blocked_on` names the notebook gate the real check is
waiting on (`G01` for architecture preservation, which needs homography;
`G02` for per-instance identity/colour/placement, which needs the one-hero-
product experiment).
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum


class Verdict(StrEnum):
    PASS = "pass"
    ABSENT = "absent"
    WRONG_IDENTITY = "wrong_identity"
    WRONG_COLOR = "wrong_color"
    DISPLACED = "displaced"
    DISTORTED = "distorted"
    ARCHITECTURE_ALTERED = "architecture_altered"
    NOT_EVALUATED = "not_evaluated"


@dataclass(frozen=True)
class InstanceValidation:
    """Per-instance post-render check result.

    `identity_score` (CLIP/DINO cosine vs. reference) and `color_delta_e`
    are triage signals only — `06_room_generation.md`: "Automated
    embeddings may assist triage but cannot certify exact identity."
    Designer side-by-side review is the acceptance mechanism, not these
    fields.
    """

    instance_id: str
    expected_product_id: str
    present: bool | None
    identity_score: float | None
    color_delta_e: float | None
    bbox_iou: float | None
    verdict: Verdict
    blocked_on: str | None = None

    def __post_init__(self) -> None:
        if not self.instance_id.strip():
            raise ValueError("instance_id is required")
        _check_blocked_on(self.verdict, self.blocked_on)


@dataclass(frozen=True)
class ArchitectureValidation:
    """Per-protected-region check: did generation alter a door, window or
    retained object outside the permitted feather band."""

    region_id: str
    verdict: Verdict
    blocked_on: str | None = None

    def __post_init__(self) -> None:
        if not self.region_id.strip():
            raise ValueError("region_id is required")
        _check_blocked_on(self.verdict, self.blocked_on)


@dataclass(frozen=True)
class RoomValidationResult:
    """Aggregate result for one render candidate.

    Deliberately exposes per-verdict counts rather than a single score —
    "a room that scores 0.8 by hiding one absent hero product and one wrong
    colour is not 80% acceptable"
    (`agentic_flow/14_room_generation_technical_design.md`).
    """

    render_job_id: str
    instance_validations: tuple[InstanceValidation, ...]
    architecture_validations: tuple[ArchitectureValidation, ...]

    def counts_by_verdict(self) -> dict[Verdict, int]:
        counts: dict[Verdict, int] = {}
        for verdict in self._all_verdicts():
            counts[verdict] = counts.get(verdict, 0) + 1
        return counts

    @property
    def fully_not_evaluated(self) -> bool:
        return all(verdict is Verdict.NOT_EVALUATED for verdict in self._all_verdicts())

    def _all_verdicts(self) -> tuple[Verdict, ...]:
        return (
            *(iv.verdict for iv in self.instance_validations),
            *(av.verdict for av in self.architecture_validations),
        )


def _check_blocked_on(verdict: Verdict, blocked_on: str | None) -> None:
    if verdict is Verdict.NOT_EVALUATED and not (blocked_on or "").strip():
        raise ValueError("verdict NOT_EVALUATED requires blocked_on to cite a gate")
    if verdict is not Verdict.NOT_EVALUATED and blocked_on is not None:
        raise ValueError("blocked_on only applies to verdict NOT_EVALUATED")
