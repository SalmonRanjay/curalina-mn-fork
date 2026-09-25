"""Pure PNG integrity check (no imaging dependency)."""

from __future__ import annotations

import struct
import zlib
from dataclasses import dataclass

_SIGNATURE = b"\x89PNG\r\n\x1a\n"
MIN_DIMENSION = 8
MAX_DIMENSION = 8192


class InvalidPngError(ValueError):
    pass


@dataclass(frozen=True, slots=True)
class PngInfo:
    width: int
    height: int


def validate_png(data: bytes, *, max_pixels: int) -> PngInfo:
    """Verify signature, every chunk CRC, IHDR, decompressable IDAT, IEND,
    and plausible dimensions. Raises `InvalidPngError`."""
    if not data.startswith(_SIGNATURE):
        raise InvalidPngError("missing PNG signature")
    pos = len(_SIGNATURE)
    width = height = 0
    idat = bytearray()
    seen_ihdr = seen_iend = False
    first = True
    while pos < len(data) and not seen_iend:
        if pos + 8 > len(data):
            raise InvalidPngError("truncated chunk header")
        length, ctype = struct.unpack(">I4s", data[pos : pos + 8])
        body_start = pos + 8
        body_end = body_start + length
        if body_end + 4 > len(data):
            raise InvalidPngError("truncated chunk")
        body = data[body_start:body_end]
        (crc,) = struct.unpack(">I", data[body_end : body_end + 4])
        if zlib.crc32(ctype + body) & 0xFFFFFFFF != crc:
            raise InvalidPngError("chunk CRC mismatch")
        if first and ctype != b"IHDR":
            raise InvalidPngError("IHDR must be the first chunk")
        first = False
        if ctype == b"IHDR":
            if length != 13:
                raise InvalidPngError("bad IHDR length")
            width, height = struct.unpack(">II", body[:8])
            seen_ihdr = True
        elif ctype == b"IDAT":
            idat.extend(body)
        elif ctype == b"IEND":
            seen_iend = True
        pos = body_end + 4
    if not seen_ihdr or not seen_iend:
        raise InvalidPngError("missing IHDR or IEND")
    if not idat:
        raise InvalidPngError("no image data")
    try:
        raw = zlib.decompress(bytes(idat))
    except zlib.error as exc:
        raise InvalidPngError(f"image data does not decompress: {exc}") from exc
    if not raw:
        raise InvalidPngError("empty image data")
    if not (
        MIN_DIMENSION <= width <= MAX_DIMENSION
        and MIN_DIMENSION <= height <= MAX_DIMENSION
    ):
        raise InvalidPngError(f"implausible dimensions {width}x{height}")
    if width * height > max_pixels:
        raise InvalidPngError(f"{width}x{height} exceeds the pixel limit")
    return PngInfo(width=width, height=height)
