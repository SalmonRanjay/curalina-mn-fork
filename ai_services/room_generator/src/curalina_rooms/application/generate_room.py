"""`GenerateRoom` — run a bounded number of generation attempts through a
`GroundedGenerationAdapter`, producing the next `RenderJobState`.

This represents what A3's worker will call per attempt; it is not itself an
API request handler and performs no I/O beyond the injected adapter and
clock (`architecture/guides/00 ... ` / `agent_instructions/03_room_generator
_service.md`: "Image APIs enqueue a durable job and return immediately. A
worker process runs inference.").
"""

from __future__ import annotations

from dataclasses import dataclass

from curalina_rooms.domain.errors import MaxAttemptsExceededError
from curalina_rooms.domain.generation_outcome import GenerationOutcome
from curalina_rooms.domain.render_job import (
    CandidateReviewStatus,
    CommercialAvailability,
    JobStatus,
    RenderJobState,
)
from curalina_rooms.domain.render_plan import RenderPlan
from curalina_rooms.ports.grounded_generation import GroundedGenerationAdapter


@dataclass(frozen=True)
class GenerateRoomResult:
    job_state: RenderJobState
    outcome: GenerationOutcome


def generate_room(
    plan: RenderPlan,
    *,
    adapter: GroundedGenerationAdapter,
    max_attempts: int,
    prior_attempt_count: int,
    commercial_availability: CommercialAvailability,
) -> GenerateRoomResult:
    if prior_attempt_count >= max_attempts:
        raise MaxAttemptsExceededError(
            plan.render_job_id, prior_attempt_count, max_attempts
        )

    outcome = adapter.generate(plan)
    attempt_count = prior_attempt_count + 1

    if outcome.succeeded:
        # `candidate_id` is set to the generated placeholder asset id here;
        # a real candidate record (with its own `cand_` id, per
        # `ai_services/contracts/v1/id_versioning.md`) is an A3/API-layer
        # concern once durable job storage exists.
        job_state = RenderJobState(
            render_job_id=plan.render_job_id,
            job_status=JobStatus.SUCCEEDED,
            review_status=CandidateReviewStatus.PENDING,
            commercial_availability=commercial_availability,
            attempt_count=attempt_count,
            candidate_id=outcome.candidate_asset_id,
        )
    else:
        job_state = RenderJobState(
            render_job_id=plan.render_job_id,
            job_status=JobStatus.FAILED,
            review_status=CandidateReviewStatus.NOT_APPLICABLE,
            commercial_availability=commercial_availability,
            attempt_count=attempt_count,
            candidate_id=None,
        )

    return GenerateRoomResult(job_state=job_state, outcome=outcome)
