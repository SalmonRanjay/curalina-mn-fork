"""Deterministic LAB colour-transfer adapter for V01."""

from __future__ import annotations

import numpy as np

from curalina_variants.domain.colour_spec import RgbColour
from curalina_variants.domain.mask_spec import Mask
from curalina_variants.evaluation.colour_math import lab_to_srgb_u8, srgb_u8_to_lab
from curalina_variants.evaluation.image_io import decode_rgb, encode_png
from curalina_variants.evaluation.metrics import (
    evaluate_transfer_metrics,
    mask_to_bool,
)
from curalina_variants.ports.colour_transfer import (
    ColourTransferAdapter,
    ColourTransferResult,
)


class LabColourTransferAdapter(ColourTransferAdapter):
    """Recolour editable pixels by preserving source L* and setting a*/b*
    to the requested target colour.

    This is V01's deterministic baseline. It does not certify colour quality
    or product identity; diagnostics are measurements for the notebook and
    decision record.
    """

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
        source_lab = srgb_u8_to_lab(source_rgb)
        recolour_lab = source_lab.copy()
        recolour_lab[..., 1][editable] = target_lab[1]
        recolour_lab[..., 2][editable] = target_lab[2]
        recoloured_rgb, clipped = lab_to_srgb_u8(recolour_lab)
        output_rgb = source_rgb.copy()
        output_rgb[editable] = recoloured_rgb[editable]
        metrics = evaluate_transfer_metrics(
            source_rgb=source_rgb,
            output_rgb=output_rgb,
            editable_mask=editable,
            feather_px=mask.feather_px,
            target_lab=target_lab,
            clipped_mask=clipped,
        )
        return ColourTransferResult(
            image_bytes=encode_png(output_rgb),
            diagnostics={
                "adapter": "LabColourTransferAdapter",
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
