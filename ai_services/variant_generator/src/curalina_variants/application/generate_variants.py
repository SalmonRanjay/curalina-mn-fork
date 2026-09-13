"""Use case: run the recolour pipeline for one candidate.

Orchestrates whatever `ColourTransferAdapter` (and optionally
`DiffusionRefinementAdapter`) is injected at bootstrap. In A2 that is always
the fake adapters (`adapters.fake_colour_transfer`,
`adapters.fake_diffusion_refinement`) — no real image transformation happens
here or beneath this use case until V01/V02 clear their gates (see
`ports/colour_transfer.py`, `ports/diffusion_refinement.py`).

This module deliberately does not touch asset storage or job persistence —
those are A3's durable job/worker concern. It maps one `Mask` + `ColourSpec`
+ source bytes to one `VisualVariant`, nothing else.
"""

from __future__ import annotations

from dataclasses import dataclass

from curalina_variants.domain.colour_spec import ColourSpec
from curalina_variants.domain.commercial_status import CommercialAvailability
from curalina_variants.domain.mask_spec import Mask
from curalina_variants.domain.review import ReviewDecision
from curalina_variants.domain.variant_candidate import JobOutcome, VisualVariant
from curalina_variants.ports.colour_transfer import ColourTransferAdapter
from curalina_variants.ports.diffusion_refinement import DiffusionRefinementAdapter


class DiffusionRefinementRequested(Exception):
    """Raised when a request asks for diffusion refinement but no
    `DiffusionRefinementAdapter` was configured for this use case."""


@dataclass(frozen=True, slots=True)
class GenerateCandidateRequest:
    variant_id: str
    parent_product_id: str
    source_asset_id: str
    mask: Mask
    source_image: bytes
    target_colour: ColourSpec
    product_type: str = "product"
    seed: int = 0
    use_diffusion_refinement: bool = False


class GenerateCandidateUseCase:
    """Generates one `VisualVariant` candidate via the injected adapters."""

    def __init__(
        self,
        colour_transfer: ColourTransferAdapter,
        diffusion_refinement: DiffusionRefinementAdapter | None = None,
    ) -> None:
        self._colour_transfer = colour_transfer
        self._diffusion_refinement = diffusion_refinement

    def execute(self, request: GenerateCandidateRequest) -> VisualVariant:
        transfer = self._colour_transfer.transfer(
            request.source_image, request.mask, request.target_colour.colour
        )
        manifest: dict[str, object] = {"colour_transfer": dict(transfer.diagnostics)}

        if request.use_diffusion_refinement:
            if self._diffusion_refinement is None:
                raise DiffusionRefinementRequested(
                    "use_diffusion_refinement=True but no DiffusionRefinementAdapter "
                    "was configured for this use case"
                )
            refinement = self._diffusion_refinement.refine(
                transfer.image_bytes,
                request.mask,
                request.product_type,
                request.target_colour.colour_name,
                request.seed,
            )
            manifest["diffusion_refinement"] = dict(refinement.diagnostics)

        return VisualVariant(
            variant_id=request.variant_id,
            parent_product_id=request.parent_product_id,
            source_asset_id=request.source_asset_id,
            mask_id=request.mask.mask_id,
            target_colour=request.target_colour,
            job_outcome=JobOutcome.SUCCEEDED,
            review_status=ReviewDecision.PENDING,
            commercial_status=CommercialAvailability.CONCEPTUAL,
            output_asset_id=None,
            generation_manifest=manifest,
        )
