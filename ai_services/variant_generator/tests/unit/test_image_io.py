from __future__ import annotations

import numpy as np

from curalina_variants.evaluation.image_io import decode_rgb, encode_png


def test_encode_decode_round_trip_preserves_pixels() -> None:
    rgb = np.zeros((4, 3, 3), dtype=np.uint8)
    rgb[0, 0] = [10, 20, 30]
    rgb[3, 2] = [255, 0, 128]

    round_tripped = decode_rgb(encode_png(rgb))

    assert round_tripped.shape == rgb.shape
    assert np.array_equal(round_tripped, rgb)


def test_decode_rgb_converts_non_rgb_mode() -> None:
    from io import BytesIO

    from PIL import Image

    grayscale = Image.new("L", (2, 2), color=128)
    buffer = BytesIO()
    grayscale.save(buffer, format="PNG")

    decoded = decode_rgb(buffer.getvalue())

    assert decoded.shape == (2, 2, 3)
    assert np.all(decoded == 128)
