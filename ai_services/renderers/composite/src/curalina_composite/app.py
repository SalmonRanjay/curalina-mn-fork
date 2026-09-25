"""FastAPI transport for the composite renderer."""

from __future__ import annotations

import json
import os
import time
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse, Response

from .palette import UnsupportedBrief
from .render import NoCatalogueImages, render_room
from .schemas import LABEL, MODEL_ID, RENDERER_NAME, ErrorBody, RenderRequest


def _error(status: int, code: str, message: str, retryable: bool) -> JSONResponse:
    body = ErrorBody(code=code, message=message, retryable=retryable)
    return JSONResponse(status_code=status, content=body.model_dump())


def create_app(images_dir: Path | None = None) -> FastAPI:
    root = images_dir or Path(
        os.environ.get("SUPPLIER_IMAGES_DIR", "/data/supplier_images")
    )
    app = FastAPI(title="Curalina composite renderer")

    @app.exception_handler(RequestValidationError)
    async def _validation(_: Request, exc: RequestValidationError) -> JSONResponse:
        first = exc.errors()[0] if exc.errors() else {}
        loc = ".".join(str(p) for p in first.get("loc", ()))
        return _error(422, "invalid_request", f"{loc}: {first.get('msg', '')}", False)

    @app.get("/healthz")
    def healthz() -> dict[str, object]:
        # Always HTTP 200; `ready` reports whether the catalogue mount exists.
        return {"status": "ok", "renderer": RENDERER_NAME, "ready": root.is_dir()}

    @app.post("/v1/render")
    def render(req: RenderRequest) -> Response:
        start = time.monotonic()
        try:
            result = render_room(
                root,
                req.brief.room_type,
                req.brief.style,
                req.brief.atmosphere,
                req.width,
                req.height,
                req.seed,
                req.prompt,
            )
        except UnsupportedBrief as exc:
            return _error(422, exc.code, str(exc), False)
        except NoCatalogueImages as exc:
            return _error(503, "no_catalogue_images", str(exc), False)
        except Exception as exc:  # noqa: BLE001
            return _error(500, "render_failed", f"render failed: {exc}", True)
        return Response(
            content=result.png,
            media_type="image/png",
            headers={
                "X-Renderer": RENDERER_NAME,
                "X-Model-Id": MODEL_ID,
                "X-Elapsed-Ms": str(int((time.monotonic() - start) * 1000)),
                "X-Label": LABEL,
                "X-Pieces": json.dumps(result.pieces, ensure_ascii=True),
            },
        )

    return app
