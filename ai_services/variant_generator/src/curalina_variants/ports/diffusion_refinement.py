"""Port for the optional SDXL-inpainting refinement pass.

This is V02's eventual home: SDXL inpainting seeded with the LAB-precoloured
image, per
`agentic_flow/15_variant_generation_technical_design.md` ("Diffusion path
(experiment, V02)"). V02 is blocked behind V01 (it refines V01's output) and
inherits both of V01's blockers — no frozen/reviewed notebook run, and no
real upholstery/product photographs to run it against. Until then, every
caller is wired against
`adapters.fake_diffusion_refinement.FakeDiffusionRefinementAdapter`.

A real implementation must still run `hard_composite` to restore protected
pixels outside the feather band from the original — that compositing step is
not optional and is not part of this port's contract; it is the calling
application code's responsibility once a real adapter exists.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any

from curalina_variants.domain.mask_spec import Mask


@dataclass(frozen=True, slots=True)
class DiffusionRefinementResult:
    """Output of a diffusion refinement attempt. See
    `ColourTransferResult` for the `diagnostics` caveat — the same applies
    here."""

    image_bytes: bytes
    diagnostics: dict[str, Any] = field(default_factory=dict)


class DiffusionRefinementAdapter(ABC):
    """Refines `precoloured_image` (the LAB baseline's output) toward
    `colour_name` for `product_type`, honouring `mask`'s editable region.
    `seed` must make output deterministic for a fixed input — required for
    the same reproducibility guarantee real adapters need for evaluation
    (`05_variants.md`/A6)."""

    @abstractmethod
    def refine(
        self,
        precoloured_image: bytes,
        mask: Mask,
        product_type: str,
        colour_name: str,
        seed: int,
    ) -> DiffusionRefinementResult:
        raise NotImplementedError
