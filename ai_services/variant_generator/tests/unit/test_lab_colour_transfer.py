from __future__ import annotations

from io import BytesIO

import numpy as np
from PIL import Image

from curalina_variants.adapters.lab_colour_transfer import LabColourTransferAdapter
from curalina_variants.domain.colour_spec import RgbColour
from curalina_variants.domain.mask_spec import Mask


def _png_bytes(rgb: np.ndarray) -> bytes:
    output = BytesIO()
    Image.fromarray(rgb.astype(np.uint8), mode="RGB").save(output, format="PNG")
    return output.getvalue()


def _read_png(image_bytes: bytes) -> np.ndarray:
    with Image.open(BytesIO(image_bytes)) as image:
        return np.asarray(image.convert("RGB"), dtype=np.uint8)


def test_lab_colour_transfer_preserves_protected_pixels() -> None:
    source = np.array(
        [
            [[240, 240, 240], [80, 80, 80]],
            [[70, 70, 70], [240, 240, 240]],
        ],
        dtype=np.uint8,
    )
    mask = Mask(
        mask_id="mask_v01_unit",
        source_asset_id="asset_v01_unit",
        width_px=2,
        height_px=2,
        editable_mask=bytes([0, 1, 1, 0]),
        feather_px=0,
        human_corrected=True,
    )

    result = LabColourTransferAdapter().transfer(
        _png_bytes(source), mask, RgbColour.from_hex("#1b4d3e")
    )
    output = _read_png(result.image_bytes)

    assert np.array_equal(output[0, 0], source[0, 0])
    assert np.array_equal(output[1, 1], source[1, 1])
    assert not np.array_equal(output[0, 1], source[0, 1])
    assert result.diagnostics["m1_assertion_held"] is True
    assert result.diagnostics["changed_pixels_outside_dilated_mask"] == 0
    assert result.diagnostics["adapter"] == "LabColourTransferAdapter"


def test_lab_colour_transfer_rejects_mismatched_mask_dimensions() -> None:
    mask = Mask(
        mask_id="mask_bad_dims",
        source_asset_id="asset_v01_unit",
        width_px=1,
        height_px=1,
        editable_mask=bytes([1]),
    )

    try:
        LabColourTransferAdapter().transfer(
            _png_bytes(np.zeros((2, 2, 3), dtype=np.uint8)),
            mask,
            RgbColour.from_hex("#ffffff"),
        )
    except ValueError as exc:
        assert "mask dimensions" in str(exc)
    else:
        raise AssertionError("expected ValueError")
