"""Shared PNG/webp decode-encode helpers for V01 adapters and evaluation.

Pulled out of `adapters/lab_colour_transfer.py` so the identity control
adapter (`adapters/identity_colour_transfer.py`) does not duplicate image
codec code. No business logic lives here: this is I/O plumbing only.
"""

from __future__ import annotations

from io import BytesIO

import numpy as np
from numpy.typing import NDArray
from PIL import Image


def decode_rgb(image_bytes: bytes) -> NDArray[np.uint8]:
    with Image.open(BytesIO(image_bytes)) as image:
        return np.asarray(image.convert("RGB"), dtype=np.uint8)


def encode_png(rgb: NDArray[np.uint8]) -> bytes:
    output = BytesIO()
    Image.fromarray(rgb, mode="RGB").save(output, format="PNG")
    return output.getvalue()
