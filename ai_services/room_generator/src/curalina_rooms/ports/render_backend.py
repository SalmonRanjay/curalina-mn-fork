"""`RenderBackend` port: turns a prompt into real PNG bytes.

Implementations raise `RenderBackendError` with a stable `code` for every
failure; they must never return placeholder bytes to make a job look done.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol

CODE_UNREACHABLE = "renderer_unreachable"
CODE_TIMEOUT = "renderer_timeout"
CODE_SERVER_ERROR = "renderer_server_error"
CODE_REJECTED = "renderer_rejected_request"
CODE_INVALID_IMAGE = "renderer_invalid_image"
CODE_ASSET_WRITE_FAILED = "asset_write_failed"
CODE_UNEXPECTED = "render_unexpected_error"


class RenderBackendError(Exception):
    def __init__(
        self,
        code: str,
        message: str,
        *,
        retryable: bool = False,
        details: dict[str, str] | None = None,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.retryable = retryable
        self.details = details or {}


@dataclass(frozen=True, slots=True)
class RenderRequest:
    prompt: str
    negative_prompt: str | None
    width: int
    height: int
    seed: int | None
    renderer: str
    room_type: str
    style: str
    atmosphere: str
    pattern: str | None


@dataclass(frozen=True, slots=True)
class RenderedImage:
    png_bytes: bytes
    renderer: str
    model_id: str
    label: str
    elapsed_ms: int


class RenderBackend(Protocol):
    def render(self, request: RenderRequest) -> RenderedImage: ...
