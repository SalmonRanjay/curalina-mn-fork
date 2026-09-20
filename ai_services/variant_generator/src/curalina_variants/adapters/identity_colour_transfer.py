"""C1 identity/no-op control adapter (`ADR-0012` §D6).

Implements `ColourTransferAdapter` with the colour transform replaced by a
pure pass-through, so the mandatory identity control runs through the same
composite/metrics path as the real adapter rather than a special-cased
notebook branch. **Control-only**: this adapter must never be wired into a
production bootstrap. Its entire purpose is to prove the V01 metric set can
tell "nothing happened" apart from "colour was transferred" — per `ADR-0012`
D6/C1, M1/M2/M4 are expected to trivially pass and only M3 is expected to
fail, at the pair's do-nothing distance.
"""

from __future__ import annotations

import numpy as np

from curalina_variants.domain.colour_spec import RgbColour
from curalina_variants.domain.mask_spec import Mask
from curalina_variants.evaluation.colour_math import srgb_u8_to_lab
from curalina_variants.evaluation.image_io import decode_rgb, encode_png
from curalina_variants.evaluation.metrics import (
    evaluate_transfer_metrics,
    mask_to_bool,
)
from curalina_variants.ports.colour_transfer import (
    ColourTransferAdapter,
    ColourTransferResult,
)


class IdentityColourTransferAdapter(ColourTransferAdapter):
    """Outputs the source image byte-for-byte unchanged. Diagnostics are
    computed through the real `evaluate_transfer_metrics` path so control
    results are directly comparable to `LabColourTransferAdapter` results."""

    def transfer(
        self, source_image: bytes, mask: Mask, target_colour: RgbColour
    ) -> ColourTransferResult:
        source_rgb = decode_rgb(source_image)
        if source_rgb.shape[:2] != (mask.height_px, mask.width_px):
            raise ValueError(
                "mask dimensions do not match source image dimensions: "
                f"{mask.width_px}x{mask.height_px} vs "
                f"{source_rgb.shape[1]}x{source_rgb.shape[0]}"
            )
        editable = mask_to_bool(mask)
        target_rgb = np.array(
            [[[target_colour.red, target_colour.green, target_colour.blue]]],
            dtype=np.uint8,
        )
        target_lab = srgb_u8_to_lab(target_rgb)[0, 0]
        clipped = np.zeros(source_rgb.shape[:2], dtype=np.bool_)
        metrics = evaluate_transfer_metrics(
            source_rgb=source_rgb,
            output_rgb=source_rgb,
            editable_mask=editable,
            feather_px=mask.feather_px,
            target_lab=target_lab,
            clipped_mask=clipped,
        )
        return ColourTransferResult(
            image_bytes=encode_png(source_rgb),
            diagnostics={
                "adapter": "IdentityColourTransferAdapter",
                "control": "C1_identity_no_op",
                "target_colour_hex": target_colour.hex,
                "m1_assertion_held": metrics.m1_assertion_held,
                "changed_pixels_outside_dilated_mask": (
                    metrics.changed_pixels_outside_dilated_mask
                ),
                "l_variance_ratio": metrics.l_variance_ratio,
                "gamut_clipped_fraction": metrics.gamut_clipped_fraction,
                "delta_e00_to_target_mean": metrics.delta_e00_to_target_mean,
                "silhouette_iou": metrics.silhouette_iou,
                "source_mask_l_std": metrics.source_mask_l_std,
                "editable_pixel_count": metrics.editable_pixel_count,
            },
        )
