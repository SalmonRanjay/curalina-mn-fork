"""What a `GroundedGenerationAdapter.generate` call returns.

This is the boundary between "generation ran" and "generation is
acceptable" — success here means only that an attempt produced a candidate
asset, not that the depicted products are correctly identified, coloured,
placed or that architecture was preserved (that is
`curalina_rooms.domain.validation.RoomValidationResult`'s job entirely).
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class GenerationOutcome:
    render_job_id: str
    attempt_count: int
    succeeded: bool
    candidate_asset_id: str | None
    failure_reason: str | None

    def __post_init__(self) -> None:
        if self.attempt_count < 1:
            raise ValueError("attempt_count must be >= 1")
        if self.succeeded and self.candidate_asset_id is None:
            raise ValueError("a succeeded outcome requires candidate_asset_id")
        if not self.succeeded and self.candidate_asset_id is not None:
            raise ValueError("a failed outcome must not carry candidate_asset_id")
        if not self.succeeded and not (self.failure_reason or "").strip():
            raise ValueError("a failed outcome requires failure_reason")
