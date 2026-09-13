"""Fake `ColourTransferAdapter` — deterministic, fast, explicitly not real.

Per `agentic_flow/variant_generator_workflow.md` A2 step 4: "a fake
`ImageEditor` adapter returning deterministic tiny images ... this is what
makes A3 possible before any real model is approved." This adapter performs
**no colour-space math of any kind** — no LAB conversion, no chroma
retargeting, no compositing. It is a labelled no-op pass-through so that job
plumbing, application use cases, and tests can exercise the
`ColourTransferAdapter` port today.

Do not use this adapter's `diagnostics` or output bytes as evidence that
recolouring happened; `diagnostics["fake"]` is always `True` precisely so
nothing downstream can mistake this for V01's baseline.
"""

from __future__ import annotations

from curalina_variants.domain.colour_spec import RgbColour
from curalina_variants.domain.mask_spec import Mask
from curalina_variants.ports.colour_transfer import (
    ColourTransferAdapter,
    ColourTransferResult,
)


class FakeColourTransferAdapter(ColourTransferAdapter):
    """No-op pass-through fake. Returns `source_image` unchanged."""

    def transfer(
        self, source_image: bytes, mask: Mask, target_colour: RgbColour
    ) -> ColourTransferResult:
        return ColourTransferResult(
            image_bytes=source_image,
            diagnostics={
                "fake": True,
                "adapter": "FakeColourTransferAdapter",
                "note": "no-op passthrough; no LAB colour-space math performed",
                "mask_id": mask.mask_id,
                "target_colour_hex": target_colour.hex,
            },
        )
