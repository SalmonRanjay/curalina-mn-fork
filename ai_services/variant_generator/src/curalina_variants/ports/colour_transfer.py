"""Port for recolouring a product image's editable region.

This is V01's eventual home: the LAB lightness/chroma-separated colour
transfer baseline described in
`agentic_flow/15_variant_generation_technical_design.md` ("Recolour — LAB
baseline (primary)"). Real LAB colour-space math (`cv2.cvtColor`, chroma
retargeting, dark-to-light risk scoring) is **blocked on two independent
things**: V01 has not been run/reviewed, and there are no real
upholstery/product photographs in this repo to run it against even once it
exists. Neither blocker is removed by the other. Until both clear, every
caller is wired against `adapters.fake_colour_transfer.FakeColourTransferAdapter`
(see `ai_services/work_packets/VAR-A2-01.md`).

Once V01 clears, a `LabColourTransformer` implementing this port will do the
real conversion; the port signature is written so that swap needs no change
above this line — only a new adapter registered at bootstrap.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any

from curalina_variants.domain.colour_spec import RgbColour
from curalina_variants.domain.mask_spec import Mask


@dataclass(frozen=True, slots=True)
class ColourTransferResult:
    """Output of a colour-transfer attempt.

    `diagnostics` is adapter-defined free-form metadata (e.g. dark-to-light
    risk score, once real). It is recorded on `VisualVariant.generation_manifest`
    verbatim and must never be read as a claim of accepted quality.
    """

    image_bytes: bytes
    diagnostics: dict[str, Any] = field(default_factory=dict)


class ColourTransferAdapter(ABC):
    """Recolours the editable region of `source_image` toward `target_colour`,
    preserving everything `mask` marks protected. Implementations must not
    alter pixels outside `mask.editable_mask`'s editable set — that check
    itself is real logic and belongs to whichever real adapter and its
    validation step land after V01, not to this port."""

    @abstractmethod
    def transfer(
        self, source_image: bytes, mask: Mask, target_colour: RgbColour
    ) -> ColourTransferResult:
        raise NotImplementedError
