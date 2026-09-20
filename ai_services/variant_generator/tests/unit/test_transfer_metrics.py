from __future__ import annotations

import numpy as np
import pytest

from curalina_variants.domain.mask_spec import Mask
from curalina_variants.evaluation.colour_math import srgb_u8_to_lab
from curalina_variants.evaluation.metrics import (
    dilate_mask,
    evaluate_transfer_metrics,
    mask_to_bool,
    silhouette_iou,
)


def test_mask_to_bool_and_dilate_mask() -> None:
    mask = Mask(
        mask_id="mask_metric",
        source_asset_id="asset_metric",
        width_px=3,
        height_px=3,
        editable_mask=bytes([0, 0, 0, 0, 1, 0, 0, 0, 0]),
    )

    editable = mask_to_bool(mask)
    dilated = dilate_mask(editable, radius=1)

    assert editable[1, 1] is np.bool_(True)
    assert int(np.count_nonzero(dilated)) == 9


def test_evaluate_transfer_metrics_reports_primary_values() -> None:
    source = np.array(
        [
            [[255, 255, 255], [40, 40, 40]],
            [[90, 90, 90], [255, 255, 255]],
        ],
        dtype=np.uint8,
    )
    output = source.copy()
    output[0, 1] = [30, 80, 60]
    output[1, 0] = [50, 100, 80]
    editable = np.array([[False, True], [True, False]], dtype=np.bool_)
    target_lab = srgb_u8_to_lab(np.array([[[27, 77, 62]]], dtype=np.uint8))[0, 0]
    clipped = np.array([[False, False], [True, False]], dtype=np.bool_)

    metrics = evaluate_transfer_metrics(
        source_rgb=source,
        output_rgb=output,
        editable_mask=editable,
        feather_px=0,
        target_lab=target_lab,
        clipped_mask=clipped,
    )

    assert metrics.changed_pixels_outside_dilated_mask == 0
    assert metrics.m1_assertion_held is True
    assert metrics.gamut_clipped_fraction == 0.5
    assert metrics.editable_pixel_count == 2
    assert metrics.source_mask_l_std > 0.0


def test_evaluate_transfer_metrics_rejects_bad_shapes() -> None:
    image = np.zeros((2, 2, 3), dtype=np.uint8)
    mask = np.ones((2, 2), dtype=np.bool_)
    target_lab = np.array([50.0, 0.0, 0.0], dtype=np.float64)

    with pytest.raises(ValueError, match="shapes must match"):
        evaluate_transfer_metrics(
            source_rgb=image,
            output_rgb=np.zeros((1, 1, 3), dtype=np.uint8),
            editable_mask=mask,
            feather_px=0,
            target_lab=target_lab,
            clipped_mask=mask,
        )

    with pytest.raises(ValueError, match="at least one editable"):
        evaluate_transfer_metrics(
            source_rgb=image,
            output_rgb=image,
            editable_mask=np.zeros((2, 2), dtype=np.bool_),
            feather_px=0,
            target_lab=target_lab,
            clipped_mask=mask,
        )


def test_evaluate_transfer_metrics_rejects_non_hwc3_source() -> None:
    # source_rgb.ndim != 3 branch (metrics.py:41).
    bad_source = np.zeros((2, 2), dtype=np.uint8)
    mask = np.ones((2, 2), dtype=np.bool_)
    target_lab = np.array([50.0, 0.0, 0.0], dtype=np.float64)

    with pytest.raises(ValueError, match="height, width, 3"):
        evaluate_transfer_metrics(
            source_rgb=bad_source,
            output_rgb=bad_source,
            editable_mask=mask,
            feather_px=0,
            target_lab=target_lab,
            clipped_mask=mask,
        )


def test_evaluate_transfer_metrics_rejects_wrong_channel_count() -> None:
    # source_rgb.shape[2] != 3 branch (metrics.py:41).
    bad_source = np.zeros((2, 2, 4), dtype=np.uint8)
    mask = np.ones((2, 2), dtype=np.bool_)
    target_lab = np.array([50.0, 0.0, 0.0], dtype=np.float64)

    with pytest.raises(ValueError, match="height, width, 3"):
        evaluate_transfer_metrics(
            source_rgb=bad_source,
            output_rgb=bad_source,
            editable_mask=mask,
            feather_px=0,
            target_lab=target_lab,
            clipped_mask=mask,
        )


def test_evaluate_transfer_metrics_rejects_mismatched_editable_mask_shape() -> None:
    # editable_mask.shape != source_rgb.shape[:2] branch (metrics.py:43).
    image = np.zeros((2, 2, 3), dtype=np.uint8)
    wrong_mask = np.ones((3, 3), dtype=np.bool_)
    target_lab = np.array([50.0, 0.0, 0.0], dtype=np.float64)

    with pytest.raises(ValueError, match="editable_mask shape must match"):
        evaluate_transfer_metrics(
            source_rgb=image,
            output_rgb=image,
            editable_mask=wrong_mask,
            feather_px=0,
            target_lab=target_lab,
            clipped_mask=wrong_mask,
        )


def test_evaluate_transfer_metrics_rejects_mismatched_clipped_mask_shape() -> None:
    # clipped_mask.shape != editable_mask.shape branch (metrics.py:45).
    image = np.zeros((2, 2, 3), dtype=np.uint8)
    editable = np.ones((2, 2), dtype=np.bool_)
    wrong_clipped = np.ones((3, 3), dtype=np.bool_)
    target_lab = np.array([50.0, 0.0, 0.0], dtype=np.float64)

    with pytest.raises(ValueError, match="clipped_mask shape must match"):
        evaluate_transfer_metrics(
            source_rgb=image,
            output_rgb=image,
            editable_mask=editable,
            feather_px=0,
            target_lab=target_lab,
            clipped_mask=wrong_clipped,
        )


def test_silhouette_iou_handles_empty_union() -> None:
    blank = np.full((2, 2, 3), 255, dtype=np.uint8)

    assert silhouette_iou(blank, blank) == 1.0


def test_dilate_mask_rejects_negative_radius() -> None:
    with pytest.raises(ValueError, match="radius"):
        dilate_mask(np.ones((1, 1), dtype=np.bool_), radius=-1)
