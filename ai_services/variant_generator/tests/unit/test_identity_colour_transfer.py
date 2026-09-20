from __future__ import annotations

import numpy as np
import pytest

from curalina_variants.adapters.identity_colour_transfer import (
    IdentityColourTransferAdapter,
)
from curalina_variants.domain.colour_spec import RgbColour
from curalina_variants.domain.mask_spec import Mask
from curalina_variants.evaluation.image_io import decode_rgb, encode_png


def _checker_mask(width: int, height: int, editable: tuple[int, int]) -> Mask:
    grid = np.zeros((height, width), dtype=np.uint8)
    grid[editable[1], editable[0]] = 1
    return Mask(
        mask_id="mask_identity",
        source_asset_id="asset_identity",
        width_px=width,
        height_px=height,
        editable_mask=grid.tobytes(),
    )


def test_identity_adapter_outputs_unchanged_pixels() -> None:
    source = np.array(
        [[[200, 40, 40], [40, 200, 40]], [[40, 40, 200], [10, 10, 10]]],
        dtype=np.uint8,
    )
    image_bytes = encode_png(source)
    mask = _checker_mask(2, 2, editable=(1, 0))

    result = IdentityColourTransferAdapter().transfer(
        image_bytes, mask, RgbColour(0, 0, 255)
    )

    output = decode_rgb(result.image_bytes)
    assert np.array_equal(output, source)
    assert result.diagnostics["control"] == "C1_identity_no_op"
    assert result.diagnostics["m1_assertion_held"] is True
    assert result.diagnostics["changed_pixels_outside_dilated_mask"] == 0
    assert result.diagnostics["l_variance_ratio"] == pytest.approx(1.0)
    assert result.diagnostics["gamut_clipped_fraction"] == 0.0


def test_identity_adapter_rejects_mismatched_mask_dimensions() -> None:
    source = np.zeros((2, 2, 3), dtype=np.uint8)
    mask = _checker_mask(3, 3, editable=(1, 1))

    with pytest.raises(ValueError, match="mask dimensions"):
        IdentityColourTransferAdapter().transfer(
            encode_png(source), mask, RgbColour(10, 10, 10)
        )
