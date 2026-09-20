"""Reference-free V01 metrics from ADR-0012."""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from numpy.typing import NDArray

from curalina_variants.domain.mask_spec import Mask
from curalina_variants.evaluation.colour_math import delta_e00, srgb_u8_to_lab

UInt8Array = NDArray[np.uint8]
BoolArray = NDArray[np.bool_]


@dataclass(frozen=True, slots=True)
class TransferMetrics:
    changed_pixels_outside_dilated_mask: int
    l_variance_ratio: float
    gamut_clipped_fraction: float
    delta_e00_to_target_mean: float
    silhouette_iou: float
    source_mask_l_std: float
    editable_pixel_count: int
    m1_assertion_held: bool


def evaluate_transfer_metrics(
    *,
    source_rgb: UInt8Array,
    output_rgb: UInt8Array,
    editable_mask: BoolArray,
    feather_px: int,
    target_lab: NDArray[np.float64],
    clipped_mask: BoolArray,
) -> TransferMetrics:
    if source_rgb.shape != output_rgb.shape:
        raise ValueError("source_rgb and output_rgb shapes must match")
    if source_rgb.ndim != 3 or source_rgb.shape[2] != 3:
        raise ValueError("source_rgb must have shape (height, width, 3)")
    if editable_mask.shape != source_rgb.shape[:2]:
        raise ValueError("editable_mask shape must match image height/width")
    if clipped_mask.shape != editable_mask.shape:
        raise ValueError("clipped_mask shape must match editable_mask")
    if not np.any(editable_mask):
        raise ValueError("editable_mask must contain at least one editable pixel")

    source_lab = srgb_u8_to_lab(source_rgb)
    output_lab = srgb_u8_to_lab(output_rgb)
    changed = np.any(source_rgb != output_rgb, axis=-1)
    dilated_mask = dilate_mask(editable_mask, feather_px)
    changed_outside = int(np.count_nonzero(changed & ~dilated_mask))

    source_l = source_lab[..., 0][editable_mask]
    output_l = output_lab[..., 0][editable_mask]
    source_var = float(np.var(source_l))
    output_var = float(np.var(output_l))
    l_ratio = 1.0 if source_var == 0.0 else output_var / source_var
    clip_fraction = float(np.count_nonzero(clipped_mask & editable_mask)) / float(
        np.count_nonzero(editable_mask)
    )
    mean_output_lab = np.mean(output_lab[editable_mask], axis=0)
    target = np.broadcast_to(target_lab, mean_output_lab.shape)
    delta_e = float(delta_e00(mean_output_lab, target))

    return TransferMetrics(
        changed_pixels_outside_dilated_mask=changed_outside,
        l_variance_ratio=l_ratio,
        gamut_clipped_fraction=clip_fraction,
        delta_e00_to_target_mean=delta_e,
        silhouette_iou=silhouette_iou(source_rgb, output_rgb),
        source_mask_l_std=float(np.std(source_l)),
        editable_pixel_count=int(np.count_nonzero(editable_mask)),
        m1_assertion_held=changed_outside == 0,
    )


def mask_to_bool(mask: Mask) -> BoolArray:
    return (
        np.frombuffer(mask.editable_mask, dtype=np.uint8)
        .reshape((mask.height_px, mask.width_px))
        .astype(np.bool_)
    )


def dilate_mask(mask: BoolArray, radius: int) -> BoolArray:
    if radius < 0:
        raise ValueError("radius must be >= 0")
    if radius == 0:
        return mask.copy()
    padded = np.pad(mask, radius, mode="constant", constant_values=False)
    result = np.zeros_like(mask, dtype=np.bool_)
    size = radius * 2 + 1
    for y_offset in range(size):
        for x_offset in range(size):
            result |= padded[
                y_offset : y_offset + mask.shape[0],
                x_offset : x_offset + mask.shape[1],
            ]
    return result


def silhouette_iou(source_rgb: UInt8Array, output_rgb: UInt8Array) -> float:
    source = _silhouette(source_rgb)
    output = _silhouette(output_rgb)
    union = int(np.count_nonzero(source | output))
    if union == 0:
        return 1.0
    return float(np.count_nonzero(source & output)) / float(union)


def _silhouette(rgb: UInt8Array) -> BoolArray:
    # White-background product assets dominate the V01 corpus. A deliberately
    # simple threshold keeps M4 an instrument-calibration metric at V01.
    return np.any(rgb < 245, axis=-1)
