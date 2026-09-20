from __future__ import annotations

import numpy as np
import pytest

from curalina_variants.evaluation.colour_math import (
    delta_e00,
    lab_to_srgb_u8,
    srgb_u8_to_lab,
)


def test_srgb_to_lab_canonical_values() -> None:
    white = np.array([[[255, 255, 255]]], dtype=np.uint8)
    red = np.array([[[255, 0, 0]]], dtype=np.uint8)

    white_lab = srgb_u8_to_lab(white)[0, 0]
    red_lab = srgb_u8_to_lab(red)[0, 0]

    assert white_lab[0] == pytest.approx(100.0, abs=0.001)
    assert red_lab == pytest.approx((53.241, 80.092, 67.203), abs=0.01)


def test_delta_e00_canonical_values() -> None:
    white = srgb_u8_to_lab(np.array([[[255, 255, 255]]], dtype=np.uint8))[0, 0]
    black = srgb_u8_to_lab(np.array([[[0, 0, 0]]], dtype=np.uint8))[0, 0]

    assert float(delta_e00(white, white)) == pytest.approx(0.0, abs=0.001)
    assert float(delta_e00(white, black)) == pytest.approx(100.0, abs=0.001)


def test_lab_to_srgb_reports_gamut_clipping() -> None:
    impossible = np.array([[[50.0, 120.0, 120.0]]], dtype=np.float64)

    rgb, clipped = lab_to_srgb_u8(impossible)

    assert rgb.dtype == np.uint8
    assert clipped[0, 0] is np.bool_(True)
