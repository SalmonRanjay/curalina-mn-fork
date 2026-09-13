"""`GroundedGenerationAdapter` — the composite-then-harmonize renderer.

**Blocked.** The real implementation is the eventual home of approach A
(composite-then-harmonize, the recommended primary per
`agentic_flow/14_room_generation_technical_design.md`) or approach B
(ControlNet-conditioned generation): pasting real product cutouts at
solver-computed image coordinates and running a low-denoise SDXL
harmonization pass, or generating from a depth/segmentation control map.
Both require G01 (homography — this port's `RenderPlan.room_prep` input
comes from `RoomPrepAdapter`, which is itself blocked) and G02 (one-hero-
product identity preservation, approach A vs. B comparison) before any real
model-backed implementation may be accepted.

This port never decides styling. Its only input, `RenderPlan`, wraps a
`StyledRoom` that `curalina_design_rules` already fully decided (palette,
material assignment, lighting plan, exact placements) — the adapter's job
is only to make that specification photographic.

Until G01/G02 clear, the only implementation of this port is
`curalina_rooms.adapters.fake_grounded_generation.FakeGroundedGenerationAdapter`.
"""

from __future__ import annotations

from typing import Protocol

from curalina_rooms.domain.generation_outcome import GenerationOutcome
from curalina_rooms.domain.render_plan import RenderPlan


class GroundedGenerationAdapter(Protocol):
    def generate(self, plan: RenderPlan) -> GenerationOutcome:
        """Execute one bounded generation attempt for `plan`.

        Must never substitute a different product to make generation
        easier, silently drop an expected instance, or relabel a plausible
        image as catalogue-grounded when grounding was not verified
        (`agentic_flow/room_generator_workflow.md`'s A2 boundaries).
        """
        ...
