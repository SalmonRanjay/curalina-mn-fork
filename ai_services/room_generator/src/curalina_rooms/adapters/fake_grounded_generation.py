"""`FakeGroundedGenerationAdapter` — deterministic, explicitly fake
`GroundedGenerationAdapter`.

Returns a placeholder candidate asset reference derived only from the plan's
`render_job_id` and instance IDs — **no image is generated, composited or
inpainted**. This exists to let A3's job/worker lifecycle and `application/`
orchestration be exercised with no GPU, no model weights and no network
access, per `agentic_flow/room_generator_workflow.md` A2 step 3 ("durable
job storage + fake `ImageEditor` adapter that records the plan and returns
deterministic artifacts").
"""

from __future__ import annotations

import hashlib

from curalina_rooms.domain.generation_outcome import GenerationOutcome
from curalina_rooms.domain.render_plan import RenderPlan


class FakeGroundedGenerationAdapter:
    """Fake `GroundedGenerationAdapter` implementation. Deterministic and fast."""

    def generate(self, plan: RenderPlan) -> GenerationOutcome:
        digest_source = "|".join(
            [plan.render_job_id, *(i.instance_id for i in plan.insertions)]
        ).encode("utf-8")
        digest = hashlib.sha256(digest_source).hexdigest()[:16]
        placeholder_asset_id = f"asset_fake_{digest}"
        return GenerationOutcome(
            render_job_id=plan.render_job_id,
            attempt_count=1,
            succeeded=True,
            candidate_asset_id=placeholder_asset_id,
            failure_reason=None,
        )
