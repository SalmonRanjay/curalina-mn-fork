"""V01 pair admission per `ADR-0012` §D5.

A `(image, target)` pair enters the evaluation set only if **all four**
conditions hold. Every rejection is counted and reported — `ADR-0012` §D7
forbids silently dropping a pair. Conditions 3 ("human-confirmed product
photograph") is a review outcome recorded by whoever ran the notebook, not
something this module can compute from pixels, so it is threaded through as
an explicit boolean rather than inferred here.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from numpy.typing import NDArray

from curalina_variants.evaluation.colour_math import delta_e00, srgb_u8_to_lab

DO_NOTHING_DELTA_E_FLOOR = 15.0
"""ADR-0012 D5.1: >=3x the loosest plausible identity-passing tolerance."""

WHITE_BORDER_THRESHOLD = 245
"""Matches `evaluation.metrics._silhouette`'s per-channel white cutoff."""

WHITE_BORDER_FRACTION = 0.95
"""ADR-0012 D5.2: border ring >=95% near-white admits automatically."""

CENTRAL_CROP_DELTA_E_MAX = 5.0
"""ADR-0012 D5.4: filters lifestyle/RAL-chart contaminants from swatches."""


@dataclass(frozen=True, slots=True)
class AdmissionResult:
    do_nothing_delta_e00: float
    do_nothing_admitted: bool
    background_admitted: bool
    background_note: str
    human_confirmed_product: bool
    swatch_disagreement_delta_e00: float | None
    swatch_admitted: bool

    @property
    def admitted(self) -> bool:
        return (
            self.do_nothing_admitted
            and self.background_admitted
            and self.human_confirmed_product
            and self.swatch_admitted
        )

    @property
    def rejection_reasons(self) -> tuple[str, ...]:
        reasons: list[str] = []
        if not self.do_nothing_admitted:
            reasons.append("do_nothing_delta_e_below_floor")
        if not self.background_admitted:
            reasons.append("background_not_confirmed_clean")
        if not self.human_confirmed_product:
            reasons.append("not_human_confirmed_product_photograph")
        if not self.swatch_admitted:
            reasons.append("swatch_central_crop_disagreement")
        return tuple(reasons)


def do_nothing_delta_e(
    source_region_mean_lab: NDArray[np.float64], target_lab: NDArray[np.float64]
) -> float:
    """The identity-transform distance from the source region's mean LAB to
    the requested target LAB (D5.1)."""
    return float(delta_e00(source_region_mean_lab, target_lab))


def white_border_fraction(rgb: NDArray[np.uint8], *, border_px: int = 8) -> float:
    """Fraction of an `border_px`-wide image border that is near-white,
    used for D5.2's automatic full-product-white-background admission."""
    if rgb.ndim != 3 or rgb.shape[2] != 3:
        raise ValueError("rgb must have shape (height, width, 3)")
    height, width, _ = rgb.shape
    border_px = min(border_px, height // 2, width // 2)
    if border_px <= 0:
        raise ValueError("image too small for a border ring")
    top = rgb[:border_px, :, :].reshape(-1, 3)
    bottom = rgb[-border_px:, :, :].reshape(-1, 3)
    left = rgb[:, :border_px, :].reshape(-1, 3)
    right = rgb[:, -border_px:, :].reshape(-1, 3)
    border = np.concatenate([top, bottom, left, right])
    near_white = np.all(border >= WHITE_BORDER_THRESHOLD, axis=-1)
    return float(np.count_nonzero(near_white)) / float(near_white.size)


def mean_lab(rgb: NDArray[np.uint8]) -> NDArray[np.float64]:
    """Mean LAB over every pixel of `rgb` — the mean-in-LAB target-colour
    extraction rule `ADR-0012` §D5 pins (the three candidate rules agree to
    median 0.51 Delta-E00 on this corpus)."""
    lab = srgb_u8_to_lab(rgb)
    result: NDArray[np.float64] = np.mean(lab.reshape(-1, 3), axis=0)
    return result


def region_mean_lab(
    rgb: NDArray[np.uint8], region_mask: NDArray[np.bool_]
) -> NDArray[np.float64]:
    """Mean LAB over the pixels of `rgb` selected by `region_mask` — used to
    get the source region's mean LAB for the do-nothing distance (D5.1)."""
    if rgb.shape[:2] != region_mask.shape:
        raise ValueError("rgb and region_mask must share height/width")
    if not np.any(region_mask):
        raise ValueError("region_mask must select at least one pixel")
    lab = srgb_u8_to_lab(rgb)
    result: NDArray[np.float64] = np.mean(lab[region_mask], axis=0)
    return result


def intra_file_delta_e00_p90(rgb: NDArray[np.uint8]) -> float:
    """The swatch's own intra-file CIEDE2000 p90 about its own mean LAB.

    `ADR-0012` §D5.4's second obligation: this number must travel with every
    value derived from the swatch — it is the evidence that "the swatch
    colour" is a distribution, not a point (Finding 3), independent of and
    in addition to `swatch_disagreement_delta_e00` (central-crop-vs-whole-
    image agreement, the admission check `admit_pair` enforces).
    """
    lab = srgb_u8_to_lab(rgb)
    mean_lab_value = np.mean(lab.reshape(-1, 3), axis=0)
    per_pixel = delta_e00(lab, np.broadcast_to(mean_lab_value, lab.shape))
    return float(np.percentile(per_pixel, 90))


def central_crop(rgb: NDArray[np.uint8], *, fraction: float = 0.5) -> NDArray[np.uint8]:
    """The central `fraction`-sized crop of `rgb`, used by D5.4's
    central-crop-vs-whole-image swatch consistency check."""
    if not 0.0 < fraction <= 1.0:
        raise ValueError("fraction must be in (0, 1]")
    height, width, _ = rgb.shape
    crop_h, crop_w = max(1, int(height * fraction)), max(1, int(width * fraction))
    y0, x0 = (height - crop_h) // 2, (width - crop_w) // 2
    return rgb[y0 : y0 + crop_h, x0 : x0 + crop_w]


def admit_pair(
    *,
    source_region_mean_lab: NDArray[np.float64],
    target_lab: NDArray[np.float64],
    source_rgb: NDArray[np.uint8],
    human_confirmed_backdrop: bool,
    human_confirmed_product: bool,
    swatch_disagreement_delta_e00: float | None,
) -> AdmissionResult:
    """Evaluate all four `ADR-0012` §D5 admission conditions for one pair.

    `human_confirmed_backdrop` is D5.2's "equivalent human-confirmed
    judgment for backdrop images" (e.g. `Forma/SOFA-FORMA-FRONTAL-scaled`),
    used only when the automatic white-border check fails.
    `human_confirmed_product` is D5.3, always a human judgment.
    """
    do_nothing = do_nothing_delta_e(source_region_mean_lab, target_lab)
    do_nothing_ok = do_nothing >= DO_NOTHING_DELTA_E_FLOOR

    border_fraction = white_border_fraction(source_rgb)
    border_clean = border_fraction >= WHITE_BORDER_FRACTION
    background_ok = border_clean or human_confirmed_backdrop
    if border_clean:
        background_note = f"border_ring_white_fraction={border_fraction:.3f}"
    elif human_confirmed_backdrop:
        background_note = (
            f"border_ring_white_fraction={border_fraction:.3f} "
            "(non-white backdrop, human-confirmed per D5.2)"
        )
    else:
        background_note = (
            f"border_ring_white_fraction={border_fraction:.3f} (not confirmed)"
        )

    swatch_ok = (
        swatch_disagreement_delta_e00 is None
        or swatch_disagreement_delta_e00 <= CENTRAL_CROP_DELTA_E_MAX
    )

    return AdmissionResult(
        do_nothing_delta_e00=do_nothing,
        do_nothing_admitted=do_nothing_ok,
        background_admitted=background_ok,
        background_note=background_note,
        human_confirmed_product=human_confirmed_product,
        swatch_disagreement_delta_e00=swatch_disagreement_delta_e00,
        swatch_admitted=swatch_ok,
    )
