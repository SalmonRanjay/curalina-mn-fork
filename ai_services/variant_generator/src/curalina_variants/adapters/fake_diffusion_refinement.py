"""Fake `DiffusionRefinementAdapter` — deterministic, fast, explicitly not
real.

V02's eventual home is SDXL inpainting; this fake performs **no model
inference, no compositing, no image transformation whatsoever**. It is a
labelled no-op pass-through so the port can be exercised by application code
and tests before V02 (or its prerequisite, V01) exists.

`diagnostics["fake"]` is always `True`. `seed` is recorded but does not
influence the (unchanged) output, since there is no stochastic process here
to seed.
"""

from __future__ import annotations

from curalina_variants.domain.mask_spec import Mask
from curalina_variants.ports.diffusion_refinement import (
    DiffusionRefinementAdapter,
    DiffusionRefinementResult,
)


class FakeDiffusionRefinementAdapter(DiffusionRefinementAdapter):
    """No-op pass-through fake. Returns `precoloured_image` unchanged."""

    def refine(
        self,
        precoloured_image: bytes,
        mask: Mask,
        product_type: str,
        colour_name: str,
        seed: int,
    ) -> DiffusionRefinementResult:
        return DiffusionRefinementResult(
            image_bytes=precoloured_image,
            diagnostics={
                "fake": True,
                "adapter": "FakeDiffusionRefinementAdapter",
                "note": "no-op passthrough; no SDXL inference performed",
                "mask_id": mask.mask_id,
                "product_type": product_type,
                "colour_name": colour_name,
                "seed": seed,
            },
        )
