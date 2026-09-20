from __future__ import annotations

import numpy as np
import pytest

from curalina_variants.evaluation.colour_math import srgb_u8_to_lab
from curalina_variants.evaluation.pair_admission import (
    DO_NOTHING_DELTA_E_FLOOR,
    admit_pair,
    central_crop,
    do_nothing_delta_e,
    intra_file_delta_e00_p90,
    mean_lab,
    region_mean_lab,
    white_border_fraction,
)


def _white_image(size: int = 20) -> np.ndarray:
    image = np.full((size, size, 3), 250, dtype=np.uint8)
    image[8:12, 8:12] = [120, 120, 120]
    return image


def test_do_nothing_delta_e_zero_for_identical_colours() -> None:
    lab = srgb_u8_to_lab(np.array([[[120, 120, 120]]], dtype=np.uint8))[0, 0]
    assert do_nothing_delta_e(lab, lab) == pytest.approx(0.0, abs=1e-6)


def test_white_border_fraction_high_for_clean_backdrop() -> None:
    image = _white_image()
    assert white_border_fraction(image) == pytest.approx(1.0)


def test_white_border_fraction_low_for_non_white_backdrop() -> None:
    image = np.full((20, 20, 3), 120, dtype=np.uint8)
    assert white_border_fraction(image) == pytest.approx(0.0)


def test_white_border_fraction_rejects_bad_shape() -> None:
    with pytest.raises(ValueError, match="shape"):
        white_border_fraction(np.zeros((4, 4), dtype=np.uint8))


def test_white_border_fraction_rejects_image_too_small_for_border() -> None:
    with pytest.raises(ValueError, match="too small"):
        white_border_fraction(np.zeros((1, 1, 3), dtype=np.uint8), border_px=8)


def test_admit_pair_passes_all_four_conditions() -> None:
    source = _white_image()
    source_region_mean_lab = srgb_u8_to_lab(
        np.array([[[120, 120, 120]]], dtype=np.uint8)
    )[0, 0]
    target_lab = srgb_u8_to_lab(np.array([[[30, 60, 200]]], dtype=np.uint8))[0, 0]

    result = admit_pair(
        source_region_mean_lab=source_region_mean_lab,
        target_lab=target_lab,
        source_rgb=source,
        human_confirmed_backdrop=False,
        human_confirmed_product=True,
        swatch_disagreement_delta_e00=1.2,
    )

    assert result.admitted
    assert result.rejection_reasons == ()
    assert result.do_nothing_delta_e00 >= DO_NOTHING_DELTA_E_FLOOR


def test_admit_pair_rejects_below_do_nothing_floor() -> None:
    source = _white_image()
    lab = srgb_u8_to_lab(np.array([[[120, 120, 120]]], dtype=np.uint8))[0, 0]
    # Target barely different from source -> do-nothing distance near zero.
    near_lab = srgb_u8_to_lab(np.array([[[121, 121, 121]]], dtype=np.uint8))[0, 0]

    result = admit_pair(
        source_region_mean_lab=lab,
        target_lab=near_lab,
        source_rgb=source,
        human_confirmed_backdrop=False,
        human_confirmed_product=True,
        swatch_disagreement_delta_e00=0.5,
    )

    assert not result.admitted
    assert "do_nothing_delta_e_below_floor" in result.rejection_reasons


def test_admit_pair_backdrop_needs_human_confirmation_when_not_white() -> None:
    source = np.full((20, 20, 3), 140, dtype=np.uint8)
    lab = srgb_u8_to_lab(np.array([[[140, 140, 140]]], dtype=np.uint8))[0, 0]
    target_lab = srgb_u8_to_lab(np.array([[[10, 200, 40]]], dtype=np.uint8))[0, 0]

    rejected = admit_pair(
        source_region_mean_lab=lab,
        target_lab=target_lab,
        source_rgb=source,
        human_confirmed_backdrop=False,
        human_confirmed_product=True,
        swatch_disagreement_delta_e00=None,
    )
    assert not rejected.admitted
    assert "background_not_confirmed_clean" in rejected.rejection_reasons

    confirmed = admit_pair(
        source_region_mean_lab=lab,
        target_lab=target_lab,
        source_rgb=source,
        human_confirmed_backdrop=True,
        human_confirmed_product=True,
        swatch_disagreement_delta_e00=None,
    )
    assert confirmed.background_admitted
    assert "non-white backdrop, human-confirmed" in confirmed.background_note


def test_admit_pair_rejects_when_not_human_confirmed_product() -> None:
    source = _white_image()
    lab = srgb_u8_to_lab(np.array([[[120, 120, 120]]], dtype=np.uint8))[0, 0]
    target_lab = srgb_u8_to_lab(np.array([[[30, 60, 200]]], dtype=np.uint8))[0, 0]

    result = admit_pair(
        source_region_mean_lab=lab,
        target_lab=target_lab,
        source_rgb=source,
        human_confirmed_backdrop=False,
        human_confirmed_product=False,
        swatch_disagreement_delta_e00=1.0,
    )

    assert not result.admitted
    assert "not_human_confirmed_product_photograph" in result.rejection_reasons


def test_mean_lab_matches_srgb_to_lab_of_uniform_image() -> None:
    solid = np.full((3, 3, 3), 100, dtype=np.uint8)
    expected = srgb_u8_to_lab(np.array([[[100, 100, 100]]], dtype=np.uint8))[0, 0]
    assert mean_lab(solid) == pytest.approx(expected, abs=1e-6)


def test_region_mean_lab_selects_only_masked_pixels() -> None:
    rgb = np.zeros((2, 2, 3), dtype=np.uint8)
    rgb[0, 0] = [200, 200, 200]
    rgb[1, 1] = [10, 10, 10]
    mask = np.array([[True, False], [False, False]])
    expected = srgb_u8_to_lab(np.array([[[200, 200, 200]]], dtype=np.uint8))[0, 0]
    assert region_mean_lab(rgb, mask) == pytest.approx(expected, abs=1e-6)


def test_region_mean_lab_rejects_shape_mismatch_and_empty_mask() -> None:
    rgb = np.zeros((2, 2, 3), dtype=np.uint8)
    with pytest.raises(ValueError, match="share height/width"):
        region_mean_lab(rgb, np.zeros((3, 3), dtype=np.bool_))
    with pytest.raises(ValueError, match="at least one pixel"):
        region_mean_lab(rgb, np.zeros((2, 2), dtype=np.bool_))


def test_central_crop_returns_centered_subregion() -> None:
    rgb = np.zeros((10, 10, 3), dtype=np.uint8)
    rgb[4:6, 4:6] = [1, 2, 3]
    crop = central_crop(rgb, fraction=0.2)
    assert crop.shape == (2, 2, 3)
    assert np.all(crop == [1, 2, 3])


def test_central_crop_rejects_bad_fraction() -> None:
    rgb = np.zeros((4, 4, 3), dtype=np.uint8)
    with pytest.raises(ValueError, match="fraction"):
        central_crop(rgb, fraction=0.0)
    with pytest.raises(ValueError, match="fraction"):
        central_crop(rgb, fraction=1.5)


def test_intra_file_delta_e00_p90_zero_for_uniform_swatch() -> None:
    solid = np.full((6, 6, 3), 120, dtype=np.uint8)
    assert intra_file_delta_e00_p90(solid) == pytest.approx(0.0, abs=1e-6)


def test_intra_file_delta_e00_p90_positive_for_non_uniform_swatch() -> None:
    # A swatch that is mostly one colour but has a minority of pixels far
    # from the mean has a nonzero spread about its own mean LAB (ADR-0012
    # Finding 3 / D5.4's second obligation).
    swatch = np.full((10, 10, 3), 120, dtype=np.uint8)
    swatch[0:2, 0:2] = [10, 200, 30]
    p90 = intra_file_delta_e00_p90(swatch)
    assert p90 > 0.0


def test_admit_pair_rejects_swatch_disagreement_above_threshold() -> None:
    source = _white_image()
    lab = srgb_u8_to_lab(np.array([[[120, 120, 120]]], dtype=np.uint8))[0, 0]
    target_lab = srgb_u8_to_lab(np.array([[[30, 60, 200]]], dtype=np.uint8))[0, 0]

    result = admit_pair(
        source_region_mean_lab=lab,
        target_lab=target_lab,
        source_rgb=source,
        human_confirmed_backdrop=False,
        human_confirmed_product=True,
        swatch_disagreement_delta_e00=9.0,
    )

    assert not result.admitted
    assert "swatch_central_crop_disagreement" in result.rejection_reasons
