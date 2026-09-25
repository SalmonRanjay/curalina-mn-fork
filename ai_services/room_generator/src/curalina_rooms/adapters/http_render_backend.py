"""Synchronous HTTP `RenderBackend` calling the external renderer services."""

from __future__ import annotations

import httpx

from curalina_rooms.ports.render_backend import (
    CODE_REJECTED,
    CODE_SERVER_ERROR,
    CODE_TIMEOUT,
    CODE_UNREACHABLE,
    RenderBackendError,
    RenderedImage,
    RenderRequest,
)

SCHEMA_VERSION = "1.0"


def _error_from_response(response: httpx.Response, url: str) -> RenderBackendError:
    code_default = CODE_SERVER_ERROR if response.status_code >= 500 else CODE_REJECTED
    retryable = response.status_code >= 500
    message = f"renderer returned HTTP {response.status_code}"
    details = {"url": url, "http_status": str(response.status_code)}
    try:
        body = response.json()
    except ValueError:
        body = None
    if isinstance(body, dict):
        if isinstance(body.get("retryable"), bool):
            retryable = body["retryable"]
        if isinstance(body.get("message"), str):
            message = f"{message}: {body['message']}"
        if isinstance(body.get("code"), str):
            details["renderer_code"] = body["code"]
    return RenderBackendError(
        code_default, message, retryable=retryable, details=details
    )


class HttpRenderBackend:
    def __init__(
        self,
        *,
        urls: dict[str, str],
        timeout_seconds: float,
        client: httpx.Client | None = None,
    ) -> None:
        self._urls = {name: url.rstrip("/") for name, url in urls.items()}
        self._client = client or httpx.Client(timeout=timeout_seconds)
        self._timeout = timeout_seconds

    def render(self, request: RenderRequest) -> RenderedImage:
        base = self._urls.get(request.renderer)
        if base is None:
            raise RenderBackendError(
                CODE_REJECTED, f"no URL configured for renderer {request.renderer!r}"
            )
        url = f"{base}/v1/render"
        payload = {
            "schema_version": SCHEMA_VERSION,
            "prompt": request.prompt,
            "negative_prompt": request.negative_prompt,
            "width": request.width,
            "height": request.height,
            "seed": request.seed,
            "brief": {
                "room_type": request.room_type,
                "style": request.style,
                "atmosphere": request.atmosphere,
                "pattern": request.pattern,
            },
        }
        try:
            response = self._client.post(url, json=payload, timeout=self._timeout)
        except httpx.TimeoutException as exc:
            raise RenderBackendError(
                CODE_TIMEOUT,
                f"renderer did not answer within {self._timeout}s",
                retryable=True,
                details={"url": url},
            ) from exc
        except httpx.HTTPError as exc:
            raise RenderBackendError(
                CODE_UNREACHABLE,
                f"renderer unreachable: {exc.__class__.__name__}",
                retryable=True,
                details={"url": url},
            ) from exc
        if response.status_code != 200:
            raise _error_from_response(response, url)
        headers = response.headers
        try:
            elapsed_ms = int(headers.get("X-Elapsed-Ms", "0"))
        except ValueError:
            elapsed_ms = 0
        return RenderedImage(
            png_bytes=response.content,
            renderer=headers.get("X-Renderer", request.renderer),
            model_id=headers.get("X-Model-Id", "unknown"),
            label=headers.get("X-Label", ""),
            elapsed_ms=elapsed_ms,
        )
