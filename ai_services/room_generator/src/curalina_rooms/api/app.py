"""FastAPI adapter for the room-generator `/v1` surface."""

from __future__ import annotations

from typing import Annotated, Any

from fastapi import Body, FastAPI, Header, status
from fastapi.responses import JSONResponse, Response

from curalina_rooms.adapters.filesystem_asset_store import FilesystemAssetStore
from curalina_rooms.api.errors import ContractError
from curalina_rooms.api.service import ContractResult, RoomsContractService
from curalina_rooms.api.sqlite_store import SQLiteRoomStore
from curalina_rooms.ports.asset_store import AssetStore, AssetStoreError
from curalina_rooms.settings import Settings

JsonBody = Annotated[dict[str, Any], Body()]


def _json_response(result: ContractResult) -> JSONResponse:
    return JSONResponse(
        status_code=result.http_status,
        content=result.body.model_dump(mode="json"),
        headers=result.headers,
    )


def _error_response(error: ContractError) -> JSONResponse:
    return JSONResponse(
        status_code=error.http_status,
        content=error.error.model_dump(mode="json"),
    )


def asset_store_for(settings: Settings) -> FilesystemAssetStore:
    """Generated-asset bytes live under the service data dir (shared volume)."""
    return FilesystemAssetStore(settings.curalina_data_dir / "assets")


def create_app(
    service: RoomsContractService | None = None,
    asset_store: AssetStore | None = None,
) -> FastAPI:
    settings = Settings()
    if asset_store is None:
        asset_store = asset_store_for(settings)
    blobs = asset_store
    if service is None:
        store = SQLiteRoomStore.from_database_url(settings.curalina_database_url)
        store.initialize()
        store.seed_from_fixtures()
        service = RoomsContractService(store)
    app = FastAPI(title="curalina_rooms", version="0.0.0")

    @app.post("/v1/assets", status_code=status.HTTP_201_CREATED)
    def post_asset(
        payload: JsonBody,
        x_request_id: str | None = Header(default=None, alias="X-Request-ID"),
    ) -> JSONResponse:
        try:
            return _json_response(service.import_asset(payload, x_request_id))
        except ContractError as exc:
            return _error_response(exc)

    @app.get("/v1/assets/{asset_id}/content")
    def get_asset_content(
        asset_id: str,
        x_request_id: str | None = Header(default=None, alias="X-Request-ID"),
    ) -> Response:
        # Stored bytes (rendered outputs) win; otherwise fall back to the
        # metadata-only response, which is a flat 404 for unknown ids.
        try:
            stored = blobs.get(asset_id)
        except AssetStoreError:
            return JSONResponse(
                status_code=500,
                content={
                    "code": "asset_read_failed",
                    "message": "stored asset could not be read.",
                    "details": {"asset_id": asset_id},
                    "retryable": True,
                    "request_id": x_request_id or "unknown",
                },
            )
        if stored is not None:
            return Response(content=stored.data, media_type=stored.media_type)
        try:
            return _json_response(service.get_asset_content(asset_id, x_request_id))
        except ContractError as exc:
            return _error_response(exc)

    @app.post("/v1/render-jobs", status_code=status.HTTP_202_ACCEPTED)
    def post_render_job(
        payload: JsonBody,
        x_request_id: str | None = Header(default=None, alias="X-Request-ID"),
    ) -> JSONResponse:
        try:
            return _json_response(service.create_render_job(payload, x_request_id))
        except ContractError as exc:
            return _error_response(exc)

    @app.get("/v1/jobs/{job_id}")
    def get_job(
        job_id: str,
        x_request_id: str | None = Header(default=None, alias="X-Request-ID"),
    ) -> JSONResponse:
        try:
            return _json_response(service.get_job(job_id, x_request_id))
        except ContractError as exc:
            return _error_response(exc)

    @app.post("/v1/jobs/{job_id}/cancel")
    def cancel_job(
        job_id: str,
        x_request_id: str | None = Header(default=None, alias="X-Request-ID"),
    ) -> JSONResponse:
        try:
            return _json_response(service.cancel_job(job_id, x_request_id))
        except ContractError as exc:
            return _error_response(exc)

    @app.post(
        "/v1/candidates/{candidate_id}/reviews",
        status_code=status.HTTP_201_CREATED,
    )
    def post_candidate_review(
        candidate_id: str,
        payload: JsonBody,
        x_request_id: str | None = Header(default=None, alias="X-Request-ID"),
    ) -> JSONResponse:
        try:
            return _json_response(
                service.create_candidate_review(candidate_id, payload, x_request_id)
            )
        except ContractError as exc:
            return _error_response(exc)

    return app
