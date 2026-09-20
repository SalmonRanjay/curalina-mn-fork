"""FastAPI adapter for the variant-generator `/v1` surface."""

from __future__ import annotations

from typing import Annotated, Any
from uuid import uuid4

from fastapi import Body, FastAPI, Header, Response, status
from fastapi.responses import JSONResponse

from curalina_variants.api.errors import ApiError
from curalina_variants.api.handlers import (
    ApiResponse,
    VariantJobStore,
    cancel_job,
    create_asset,
    create_mask,
    create_review,
    create_variant_job,
    get_asset_content,
    get_job,
    get_mask,
)
from curalina_variants.api.sqlite_store import SQLiteJobStore
from curalina_variants.settings import Settings

JsonBody = Annotated[dict[str, Any], Body()]


def _request_id(value: str | None) -> str:
    return value or f"req_{uuid4().hex[:16]}"


def _json_response(result: ApiResponse) -> JSONResponse:
    body = (
        result.body.model_dump(mode="json")
        if hasattr(result.body, "model_dump")
        else result.body
    )
    return JSONResponse(
        status_code=result.status_code,
        content=body,
        headers=result.headers,
    )


def _error_response(error: ApiError) -> JSONResponse:
    return JSONResponse(
        status_code=error.status_code,
        content=error.body.model_dump(mode="json"),
    )


def create_app(store: VariantJobStore | None = None) -> FastAPI:
    if store is None:
        settings = Settings()
        sqlite_store = SQLiteJobStore.from_database_url(settings.curalina_database_url)
        sqlite_store.initialize()
        store = sqlite_store
    app = FastAPI(title="curalina_variants", version="0.0.0")

    @app.post("/v1/assets", status_code=status.HTTP_201_CREATED)
    def post_asset(
        payload: JsonBody,
        x_request_id: str | None = Header(default=None, alias="X-Request-ID"),
    ) -> JSONResponse:
        try:
            return _json_response(
                create_asset(store, payload, request_id=_request_id(x_request_id))
            )
        except ApiError as exc:
            return _error_response(exc)

    @app.get("/v1/assets/{asset_id}/content")
    def get_asset_bytes(
        asset_id: str,
        x_request_id: str | None = Header(default=None, alias="X-Request-ID"),
    ) -> Response:
        try:
            result = get_asset_content(
                store, asset_id, request_id=_request_id(x_request_id)
            )
        except ApiError as exc:
            return _error_response(exc)
        return Response(
            content=result.body.content_bytes,
            media_type=result.body.media_type,
            status_code=result.status_code,
            headers=result.headers,
        )

    @app.post("/v1/masks", status_code=status.HTTP_201_CREATED)
    def post_mask(
        payload: JsonBody,
        x_request_id: str | None = Header(default=None, alias="X-Request-ID"),
    ) -> JSONResponse:
        try:
            return _json_response(
                create_mask(store, payload, request_id=_request_id(x_request_id))
            )
        except ApiError as exc:
            return _error_response(exc)

    @app.get("/v1/masks/{mask_id}")
    def get_mask_by_id(
        mask_id: str,
        x_request_id: str | None = Header(default=None, alias="X-Request-ID"),
    ) -> JSONResponse:
        try:
            return _json_response(
                get_mask(store, mask_id, request_id=_request_id(x_request_id))
            )
        except ApiError as exc:
            return _error_response(exc)

    @app.post("/v1/jobs", status_code=status.HTTP_202_ACCEPTED)
    def post_job(
        payload: JsonBody,
        idempotency_key: str = Header(alias="Idempotency-Key"),
        x_request_id: str | None = Header(default=None, alias="X-Request-ID"),
    ) -> JSONResponse:
        try:
            return _json_response(
                create_variant_job(
                    store,
                    payload,
                    idempotency_key=idempotency_key,
                    request_id=_request_id(x_request_id),
                )
            )
        except ApiError as exc:
            return _error_response(exc)

    @app.get("/v1/jobs/{job_id}")
    def get_job_status(
        job_id: str,
        x_request_id: str | None = Header(default=None, alias="X-Request-ID"),
    ) -> JSONResponse:
        try:
            return _json_response(
                get_job(store, job_id, request_id=_request_id(x_request_id))
            )
        except ApiError as exc:
            return _error_response(exc)

    @app.post("/v1/jobs/{job_id}/cancel")
    def post_job_cancel(
        job_id: str,
        x_request_id: str | None = Header(default=None, alias="X-Request-ID"),
    ) -> JSONResponse:
        try:
            return _json_response(
                cancel_job(store, job_id, request_id=_request_id(x_request_id))
            )
        except ApiError as exc:
            return _error_response(exc)

    @app.post(
        "/v1/candidates/{candidate_id}/reviews",
        status_code=status.HTTP_201_CREATED,
    )
    def post_review(
        candidate_id: str,
        payload: JsonBody,
        x_request_id: str | None = Header(default=None, alias="X-Request-ID"),
    ) -> JSONResponse:
        try:
            return _json_response(
                create_review(
                    store,
                    candidate_id,
                    payload,
                    request_id=_request_id(x_request_id),
                )
            )
        except ApiError as exc:
            return _error_response(exc)

    return app
