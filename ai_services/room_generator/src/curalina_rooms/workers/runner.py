"""Worker entry points for durable room render jobs."""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass

from curalina_rooms.adapters.fake_render_backend import FakeRenderBackend
from curalina_rooms.adapters.filesystem_asset_store import FilesystemAssetStore
from curalina_rooms.adapters.http_render_backend import HttpRenderBackend
from curalina_rooms.api.errors import ContractError
from curalina_rooms.api.postgres_store import LeaseConflictError, PostgresRoomStore
from curalina_rooms.api.schemas import JobStatusResponse
from curalina_rooms.ports.asset_store import AssetStore
from curalina_rooms.ports.render_backend import RenderBackend
from curalina_rooms.settings import Settings
from curalina_rooms.workers.concept_render import (
    ConceptRenderConfig,
    run_concept_render,
)

logger = logging.getLogger("curalina_rooms")


@dataclass(frozen=True, slots=True)
class WorkerResult:
    processed: bool
    job: JobStatusResponse | None = None


def process_one_job(
    store: PostgresRoomStore,
    *,
    worker_id: str,
    lease_seconds: int,
    backend: RenderBackend | None = None,
    asset_store: AssetStore | None = None,
    config: ConceptRenderConfig | None = None,
) -> WorkerResult:
    job = store.lease_next_job(worker_id=worker_id, lease_seconds=lease_seconds)
    if job is None:
        logger.debug("rooms worker %s: no queued job, idling", worker_id)
        return WorkerResult(processed=False)
    context = store.get_leased_job_context(job.job_id, worker_id=worker_id)
    brief = context.request.render_brief
    t0 = time.monotonic()
    if brief is None:
        # Legacy bundle-style job: fake staging only; it carries no image.
        logger.info("rooms worker %s: leased job %s (legacy bundle, no render)", worker_id, job.job_id)
        completed = store.complete_leased_job(job.job_id, worker_id=worker_id)
        logger.info("rooms worker %s: job %s -> %s", worker_id, job.job_id, completed.status)
        return WorkerResult(processed=True, job=completed)
    if asset_store is None:
        raise ValueError("asset_store is required to process a concept render")
    logger.info(
        "rooms worker %s: leased job %s (renderer=%s)",
        worker_id, job.job_id, brief.renderer or "default",
    )
    try:
        completed = run_concept_render(
            store,
            context,
            brief,
            worker_id=worker_id,
            lease_seconds=lease_seconds,
            backend=backend,
            asset_store=asset_store,
            config=config or ConceptRenderConfig(),
        )
    except (LeaseConflictError, ContractError) as exc:
        # The job was cancelled or re-leased while rendering. Report the
        # job's real stored state; never overwrite it or claim success.
        logger.warning(
            "rooms worker %s: job %s lost its lease or hit a contract error after %.1fs (%s) - reporting stored state",
            worker_id, job.job_id, time.monotonic() - t0, exc,
        )
        return WorkerResult(
            processed=True, job=store.get_job(job.job_id, request_id="worker")
        )
    logger.info(
        "rooms worker %s: job %s -> %s in %.1fs",
        worker_id, job.job_id, completed.status, time.monotonic() - t0,
    )
    return WorkerResult(processed=True, job=completed)


def build_render_backend(settings: Settings) -> RenderBackend:
    if settings.curalina_render_backend == "fake":
        return FakeRenderBackend()
    return HttpRenderBackend(
        urls={
            "sd15": settings.curalina_renderer_sd15_url,
            "composite": settings.curalina_renderer_composite_url,
        },
        timeout_seconds=float(settings.curalina_render_timeout_seconds),
    )


def run_worker_once(settings: Settings, *, worker_id: str = "worker_local") -> int:
    store = PostgresRoomStore.from_database_url(
        settings.curalina_database_url, schema=settings.curalina_database_schema
    )
    store.initialize()
    store.seed_from_fixtures()
    result = process_one_job(
        store,
        worker_id=worker_id,
        lease_seconds=settings.curalina_job_timeout_seconds,
        backend=build_render_backend(settings),
        asset_store=FilesystemAssetStore(settings.curalina_data_dir / "assets"),
        config=ConceptRenderConfig(
            default_renderer=settings.curalina_room_renderer,
            width=settings.curalina_render_width,
            height=settings.curalina_render_height,
            max_image_pixels=settings.curalina_max_image_pixels,
        ),
    )
    return 0 if result.processed else 1
