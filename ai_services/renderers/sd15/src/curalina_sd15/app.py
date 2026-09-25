"""FastAPI transport for the sd15 renderer."""

from __future__ import annotations

import io
import threading
import time
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse, Response

from .pipeline import (
    DiffusersPipelineFactory,
    Pipeline,
    PipelineFactory,
    Settings,
    model_label,
)
from .schemas import LABEL, RENDERER_NAME, ErrorBody, RenderRequest


def _error(status: int, code: str, message: str, retryable: bool) -> JSONResponse:
    body = ErrorBody(code=code, message=message, retryable=retryable)
    return JSONResponse(status_code=status, content=body.model_dump())


def create_app(
    factory: PipelineFactory | None = None, settings: Settings | None = None
) -> FastAPI:
    cfg = settings or Settings.from_env()
    fac: PipelineFactory = factory or DiffusersPipelineFactory()
    app = FastAPI(title="Curalina sd15 renderer")
    lock = threading.Lock()
    state: dict[str, Pipeline | None] = {"pipeline": None}

    @app.exception_handler(RequestValidationError)
    async def _validation(_: Request, exc: RequestValidationError) -> JSONResponse:
        first = exc.errors()[0] if exc.errors() else {}
        loc = ".".join(str(p) for p in first.get("loc", ()))
        return _error(422, "invalid_request", f"{loc}: {first.get('msg', '')}", False)

    @app.get("/healthz")
    def healthz() -> dict[str, Any]:
        # Always HTTP 200: readiness is informational so compose stays healthy
        # while the model has not been lazily loaded yet.
        return {
            "status": "ok",
            "renderer": RENDERER_NAME,
            "ready": state["pipeline"] is not None,
        }

    @app.post("/v1/render")
    def render(req: RenderRequest) -> Response:
        start = time.monotonic()
        with lock:  # one render at a time; CPU SD is memory heavy
            if state["pipeline"] is None:
                try:
                    state["pipeline"] = fac.build(cfg)
                except Exception as exc:  # noqa: BLE001
                    return _error(
                        503,
                        "model_unavailable",
                        f"could not load model {cfg.model_id}: {exc}",
                        True,
                    )
            pipeline = state["pipeline"]
            assert pipeline is not None
            try:
                image = pipeline.generate(
                    req.prompt, req.negative_prompt, req.width, req.height, req.seed
                )
                buf = io.BytesIO()
                image.convert("RGB").save(buf, format="PNG")
            except Exception as exc:  # noqa: BLE001
                return _error(500, "render_failed", f"render failed: {exc}", True)
        return Response(
            content=buf.getvalue(),
            media_type="image/png",
            headers={
                "X-Renderer": RENDERER_NAME,
                "X-Model-Id": model_label(cfg),
                "X-Elapsed-Ms": str(int((time.monotonic() - start) * 1000)),
                "X-Label": LABEL,
            },
        )

    return app
