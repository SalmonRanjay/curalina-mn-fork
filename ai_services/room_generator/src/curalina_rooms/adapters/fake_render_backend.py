"""Deterministic `RenderBackend` for unit tests and CI. Returns a tiny real,
valid PNG (a flat 64x64 RGB image whose colour is derived from the prompt).
It is labelled as a fake so it can never pass as a real render."""

from __future__ import annotations

import hashlib
import struct
import zlib

from curalina_rooms.ports.render_backend import RenderedImage, RenderRequest


def _chunk(ctype: bytes, body: bytes) -> bytes:
    return (
        struct.pack(">I", len(body))
        + ctype
        + body
        + struct.pack(">I", zlib.crc32(ctype + body) & 0xFFFFFFFF)
    )


def make_png(width: int, height: int, rgb: tuple[int, int, int]) -> bytes:
    row = b"\x00" + bytes(rgb) * width
    return (
        b"\x89PNG\r\n\x1a\n"
        + _chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0))
        + _chunk(b"IDAT", zlib.compress(row * height))
        + _chunk(b"IEND", b"")
    )


class FakeRenderBackend:
    def render(self, request: RenderRequest) -> RenderedImage:
        digest = hashlib.sha256(request.prompt.encode("utf-8")).digest()
        return RenderedImage(
            png_bytes=make_png(64, 64, (digest[0], digest[1], digest[2])),
            renderer=request.renderer,
            model_id="fake-render-backend",
            label="FAKE render (CI only, not a real image model)",
            elapsed_ms=1,
        )
