"""Concept-render execution for a leased job (ADR-0020 C3.2).

Order is load-bearing: build prompt -> render -> validate PNG -> write asset
-> only then mark the job succeeded. Every failure marks the job FAILED with
a distinct code; nothing here can produce a succeeded job without a stored,
validated image.
"""

from __future__ import annotations

import hashlib
import threading
from dataclasses import dataclass
from datetime import UTC, datetime

from curalina_rooms.api.schemas import (
    CONCEPT_PROVENANCE_MODE,
    AssetResponse,
    JobResult,
    JobStatusResponse,
    RenderBrief,
)
from curalina_rooms.api.sqlite_store import LeasedJobContext, SQLiteRoomStore
from curalina_rooms.application.prompt_builder import NEGATIVE_PROMPT, build_prompt
from curalina_rooms.domain.png_validation import InvalidPngError, validate_png
from curalina_rooms.ports.asset_store import AssetStore, AssetStoreError
from curalina_rooms.ports.render_backend import (
    CODE_ASSET_WRITE_FAILED,
    CODE_INVALID_IMAGE,
    CODE_UNEXPECTED,
    RenderBackend,
    RenderBackendError,
    RenderRequest,
)

ASSET_OWNER = "curalina_rooms_worker"
CODE_BACKEND_MISSING = "render_backend_not_configured"


@dataclass(frozen=True, slots=True)
class ConceptRenderConfig:
    default_renderer: str = "sd15"
    width: int = 512
    height: int = 512
    max_image_pixels: int = 16_777_216


def _asset_id_for(png_bytes: bytes) -> str:
    return "asset_render_" + hashlib.sha256(png_bytes).hexdigest()[:24]


class _Heartbeat:
    """Renews the job lease from a side thread while a render is in flight,
    so a long CPU render is not re-leased and run twice."""

    def __init__(
        self, store: SQLiteRoomStore, job_id: str, worker_id: str, lease_seconds: int
    ) -> None:
        self._args = (store, job_id, worker_id, lease_seconds)
        self._stop = threading.Event()
        self._interval = max(1.0, lease_seconds / 3)
        self._thread = threading.Thread(target=self._run, daemon=True)

    def _run(self) -> None:
        store, job_id, worker_id, lease_seconds = self._args
        while not self._stop.wait(self._interval):
            try:
                store.renew_lease(
                    job_id, worker_id=worker_id, lease_seconds=lease_seconds
                )
            except Exception:  # noqa: BLE001 - a missed beat only shortens the
                # lease; it never changes job status. The next beat retries.
                continue

    def __enter__(self) -> _Heartbeat:
        self._thread.start()
        return self

    def __exit__(self, *exc: object) -> None:
        self._stop.set()
        self._thread.join(timeout=5)


def run_concept_render(
    store: SQLiteRoomStore,
    context: LeasedJobContext,
    brief: RenderBrief,
    *,
    worker_id: str,
    lease_seconds: int,
    backend: RenderBackend | None,
    asset_store: AssetStore,
    config: ConceptRenderConfig,
) -> JobStatusResponse:
    job_id = context.job.job_id

    def fail(
        code: str,
        message: str,
        retryable: bool,
        details: dict[str, str] | None = None,
    ) -> JobStatusResponse:
        return store.fail_leased_job(
            job_id,
            worker_id=worker_id,
            code=code,
            message=message,
            retryable=retryable,
            details=dict(details or {}),
        )

    if context.job.attempt_count + 1 > context.max_attempts:
        return fail(
            "max_attempts_exceeded",
            "Render job exceeded its configured attempt bound.",
            False,
        )
    if backend is None:
        return fail(CODE_BACKEND_MISSING, "No render backend is configured.", False)

    renderer = brief.renderer or config.default_renderer
    request = RenderRequest(
        prompt=build_prompt(brief),
        negative_prompt=NEGATIVE_PROMPT,
        width=config.width,
        height=config.height,
        seed=brief.seed,
        renderer=renderer,
        room_type=brief.room_type,
        style=brief.style,
        atmosphere=brief.atmosphere,
        pattern=brief.pattern,
    )

    try:
        with _Heartbeat(store, job_id, worker_id, lease_seconds):
            rendered = backend.render(request)
    except RenderBackendError as exc:
        return fail(
            exc.code,
            exc.message,
            exc.retryable,
            {"renderer": renderer, **exc.details},
        )
    except Exception as exc:  # noqa: BLE001 - classified as a FAILED job below
        return fail(
            CODE_UNEXPECTED,
            f"render backend raised {exc.__class__.__name__}",
            False,
            {"renderer": renderer},
        )

    try:
        info = validate_png(rendered.png_bytes, max_pixels=config.max_image_pixels)
    except InvalidPngError as exc:
        return fail(
            CODE_INVALID_IMAGE,
            f"renderer returned an invalid image: {exc}",
            True,
            {"renderer": renderer},
        )

    asset_id = _asset_id_for(rendered.png_bytes)
    try:
        asset_store.put(asset_id, rendered.png_bytes, media_type="image/png")
    except AssetStoreError as exc:
        return fail(
            CODE_ASSET_WRITE_FAILED,
            f"could not store the rendered image: {exc}",
            True,
            {"renderer": renderer},
        )

    asset = AssetResponse(
        asset_id=asset_id,
        owner_id=ASSET_OWNER,
        content_hash="sha256:" + hashlib.sha256(rendered.png_bytes).hexdigest(),
        media_type="image/png",
        width_px=info.width,
        height_px=info.height,
        original_filename=f"{asset_id}.png",
        provenance=(
            f"{CONCEPT_PROVENANCE_MODE}: concept render by {rendered.renderer} "
            f"({rendered.model_id}); not measured, not certified"
        ),
        created_at=datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
    )
    return store.complete_concept_job(
        job_id,
        worker_id=worker_id,
        asset=asset,
        result=JobResult(
            output_asset_id=asset_id,
            renderer=rendered.renderer,
            model_id=rendered.model_id,
            label=rendered.label,
            elapsed_ms=rendered.elapsed_ms,
            provenance_mode=CONCEPT_PROVENANCE_MODE,
            measurement_certified=False,
        ),
    )
