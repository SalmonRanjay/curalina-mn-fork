from __future__ import annotations

import json
from collections.abc import Callable
from pathlib import Path
from typing import Any

import httpx
import pytest
from fastapi.testclient import TestClient

from curalina_rooms.adapters.fake_render_backend import FakeRenderBackend, make_png
from curalina_rooms.adapters.filesystem_asset_store import FilesystemAssetStore
from curalina_rooms.adapters.http_render_backend import HttpRenderBackend
from curalina_rooms.api.app import create_app
from curalina_rooms.api.errors import ContractError
from curalina_rooms.api.fixtures import load_fixture
from curalina_rooms.api.schemas import RenderBrief
from curalina_rooms.api.service import RoomsContractService
from curalina_rooms.api.sqlite_store import SQLiteRoomStore
from curalina_rooms.application.prompt_builder import NEGATIVE_PROMPT, build_prompt
from curalina_rooms.domain.png_validation import InvalidPngError, validate_png
from curalina_rooms.ports.asset_store import AssetStoreError
from curalina_rooms.ports.render_backend import (
    RenderBackend,
    RenderBackendError,
    RenderedImage,
    RenderRequest,
)
from curalina_rooms.settings import Settings
from curalina_rooms.workers import process_one_job
from curalina_rooms.workers.runner import build_render_backend, run_worker_once


def _setup(tmp_path: Path) -> tuple[SQLiteRoomStore, RoomsContractService, Path]:
    store = SQLiteRoomStore(tmp_path / "rooms.sqlite3")
    store.initialize()
    store.seed_from_fixtures()
    return store, RoomsContractService(store), tmp_path / "assets"


def _concept_job(service: RoomsContractService) -> str:
    result = service.create_render_job(load_fixture("render_job_request_concept.json"))
    assert result.http_status == 202
    return str(result.body.job_id)  # type: ignore[attr-defined]


def _files(root: Path) -> list[Path]:
    return sorted(root.glob("*")) if root.exists() else []


# --- asset store -----------------------------------------------------------


def test_asset_store_roundtrip_and_no_temp_left(tmp_path: Path) -> None:
    store = FilesystemAssetStore(tmp_path / "a")
    png = make_png(16, 16, (1, 2, 3))
    store.put("asset_ok-1", png, media_type="image/png")
    got = store.get("asset_ok-1")
    assert got is not None and got.data == png and got.media_type == "image/png"
    assert [p.name for p in (tmp_path / "a").iterdir()] == ["asset_ok-1.png"]
    assert store.get("asset_missing") is None


@pytest.mark.parametrize("bad", ["../evil", "a/b", "..", "", ".hidden", "a\\b"])
def test_asset_store_rejects_path_traversal(tmp_path: Path, bad: str) -> None:
    store = FilesystemAssetStore(tmp_path / "a")
    with pytest.raises(AssetStoreError):
        store.put(bad, b"x", media_type="image/png")
    assert store.get(bad) is None
    assert _files(tmp_path / "a") == []


def test_asset_store_failed_write_leaves_no_partial_file(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    store = FilesystemAssetStore(tmp_path / "a")

    def boom(*_: object) -> None:
        raise OSError("disk full")

    monkeypatch.setattr("os.replace", boom)
    with pytest.raises(AssetStoreError):
        store.put("asset_x", b"data", media_type="image/png")
    assert _files(tmp_path / "a") == []


def test_asset_store_rejects_unknown_media_type(tmp_path: Path) -> None:
    with pytest.raises(AssetStoreError):
        FilesystemAssetStore(tmp_path).put("a", b"x", media_type="text/html")


# --- request validation ----------------------------------------------------


def test_request_validation_brief_only_legacy_and_neither(tmp_path: Path) -> None:
    _, service, _ = _setup(tmp_path)
    assert (
        service.create_render_job(
            load_fixture("render_job_request_concept.json")
        ).http_status
        == 202
    )
    assert (
        service.create_render_job(
            load_fixture("render_job_request_valid.json")
        ).http_status
        == 202
    )
    with pytest.raises(ContractError) as exc:
        service.create_render_job({"schema_version": "1.0"})
    assert exc.value.error.code == "malformed_request"
    with pytest.raises(ContractError):
        service.create_render_job(
            {"schema_version": "1.0", "room_type": "x", "instances": []}
        )


def test_in_memory_service_accepts_concept_request() -> None:
    result = RoomsContractService().create_render_job(
        load_fixture("render_job_request_concept.json")
    )
    assert result.http_status == 202
    assert result.body.bundle_id is None  # type: ignore[attr-defined]


# --- prompt builder --------------------------------------------------------


def test_prompt_builder_is_deterministic() -> None:
    brief = RenderBrief(
        room_type="bedroom", style="modern", atmosphere="calm", pattern="stripes"
    )
    assert build_prompt(brief) == (
        "a photorealistic interior photograph of a bedroom, modern style, "
        "calm lighting and mood, stripes, editorial interior design "
        "photography, natural light, high detail"
    )
    assert build_prompt(brief) == build_prompt(brief)
    assert "pattern" not in build_prompt(brief.model_copy(update={"pattern": None}))
    assert build_prompt(brief.model_copy(update={"prompt": " custom "})) == "custom"
    assert NEGATIVE_PROMPT == (
        "people, text, watermark, distorted furniture, low quality"
    )


# --- png validation --------------------------------------------------------


def test_png_validation() -> None:
    good = make_png(64, 64, (9, 9, 9))
    assert validate_png(good, max_pixels=10_000).width == 64
    for bad in (b"", b"notpng", good[:-5], good[:40], make_png(4, 4, (0, 0, 0))):
        with pytest.raises(InvalidPngError):
            validate_png(bad, max_pixels=10_000)
    with pytest.raises(InvalidPngError):
        validate_png(good, max_pixels=100)
    corrupt = bytearray(good)
    corrupt[20] ^= 0xFF
    with pytest.raises(InvalidPngError):
        validate_png(bytes(corrupt), max_pixels=10_000)


# --- worker success + endpoint --------------------------------------------


def test_worker_success_stores_asset_and_endpoint_serves_it(tmp_path: Path) -> None:
    store, service, root = _setup(tmp_path)
    assets = FilesystemAssetStore(root)
    job_id = _concept_job(service)

    result = process_one_job(
        store,
        worker_id="w1",
        lease_seconds=60,
        backend=FakeRenderBackend(),
        asset_store=assets,
    )
    job = result.job
    assert job is not None and job.status == "succeeded" and job.attempt_count == 1
    assert job.job_id == job_id and job.error is None and job.result is not None
    res = job.result
    assert res.output_asset_id is not None
    assert res.renderer == "sd15" and res.model_id == "fake-render-backend"
    assert res.label and res.provenance_mode == "synthetic_scene"
    assert res.measurement_certified is False and res.candidate_id is None

    client = TestClient(create_app(service, assets))
    ok = client.get(f"/v1/assets/{res.output_asset_id}/content")
    assert ok.status_code == 200
    assert ok.headers["content-type"] == "image/png"
    validate_png(ok.content, max_pixels=10_000)
    polled = client.get(f"/v1/jobs/{job_id}").json()
    assert polled["result"]["output_asset_id"] == res.output_asset_id


def test_content_endpoint_404_and_legacy_metadata(tmp_path: Path) -> None:
    _, service, root = _setup(tmp_path)
    client = TestClient(create_app(service, FilesystemAssetStore(root)))
    missing = client.get("/v1/assets/asset_nope/content")
    assert missing.status_code == 404
    assert missing.json()["code"] == "resource_not_found"
    assert client.get("/v1/assets/..%2Fx/content").status_code == 404
    legacy = client.get("/v1/assets/asset_room000001/content")
    assert legacy.status_code == 200 and "content_ref" in legacy.json()


def test_content_endpoint_read_failure_is_500(tmp_path: Path) -> None:
    class Broken:
        def put(self, asset_id: str, data: bytes, *, media_type: str) -> None: ...

        def get(self, asset_id: str) -> None:
            raise AssetStoreError("nope")

    _, service, _ = _setup(tmp_path)
    resp = TestClient(create_app(service, Broken())).get("/v1/assets/a/content")
    assert resp.status_code == 500 and resp.json()["retryable"] is True


def test_legacy_job_has_no_image(tmp_path: Path) -> None:
    store, service, root = _setup(tmp_path)
    service.create_render_job(load_fixture("render_job_request_valid.json"))
    job = process_one_job(
        store,
        worker_id="w",
        lease_seconds=60,
        backend=FakeRenderBackend(),
        asset_store=FilesystemAssetStore(root),
    ).job
    assert job is not None and job.status == "succeeded" and job.result is not None
    assert job.result.output_asset_id is None
    assert _files(root) == []


# --- failure classification -----------------------------------------------


class _Raises:
    def __init__(self, exc: Exception) -> None:
        self.exc = exc

    def render(self, request: RenderRequest) -> RenderedImage:
        raise self.exc


class _Returns:
    def __init__(self, data: bytes) -> None:
        self.data = data

    def render(self, request: RenderRequest) -> RenderedImage:
        return RenderedImage(self.data, "sd15", "m", "l", 5)


@pytest.mark.parametrize(
    ("backend", "code", "retryable"),
    [
        (
            _Raises(RenderBackendError("renderer_unreachable", "down", retryable=True)),
            "renderer_unreachable",
            True,
        ),
        (
            _Raises(RenderBackendError("renderer_timeout", "slow", retryable=True)),
            "renderer_timeout",
            True,
        ),
        (
            _Raises(RenderBackendError("renderer_server_error", "500")),
            "renderer_server_error",
            False,
        ),
        (_Returns(b"not a png"), "renderer_invalid_image", True),
        (_Raises(RuntimeError("boom")), "render_unexpected_error", False),
        (None, "render_backend_not_configured", False),
    ],
)
def test_backend_failures_fail_the_job(
    tmp_path: Path, backend: RenderBackend | None, code: str, retryable: bool
) -> None:
    store, service, root = _setup(tmp_path)
    job_id = _concept_job(service)
    job = process_one_job(
        store,
        worker_id="w",
        lease_seconds=60,
        backend=backend,
        asset_store=FilesystemAssetStore(root),
    ).job
    assert job is not None and job.status == "failed"
    assert job.error is not None and job.error.code == code
    assert job.error.retryable is retryable and job.error.message
    assert job.result is None
    assert _files(root) == []
    stored = store.get_job(job_id, request_id="t")
    assert stored.status == "failed" and stored.result is None


def test_asset_write_failure_fails_the_job(tmp_path: Path) -> None:
    class BadStore:
        def put(self, asset_id: str, data: bytes, *, media_type: str) -> None:
            raise AssetStoreError("read-only fs")

        def get(self, asset_id: str) -> None:
            return None

    store, service, _ = _setup(tmp_path)
    _concept_job(service)
    job = process_one_job(
        store,
        worker_id="w",
        lease_seconds=60,
        backend=FakeRenderBackend(),
        asset_store=BadStore(),
    ).job
    assert job is not None and job.status == "failed"
    assert job.error is not None and job.error.code == "asset_write_failed"
    assert job.result is None


def test_max_attempts_exceeded_fails_without_rendering(tmp_path: Path) -> None:
    store = SQLiteRoomStore(tmp_path / "r.sqlite3")
    store.initialize()
    store.seed_from_fixtures()
    service = RoomsContractService(store, max_attempts=1)
    _concept_job(service)
    calls: list[int] = []

    class Counting(FakeRenderBackend):
        def render(self, request: RenderRequest) -> RenderedImage:
            calls.append(1)
            return super().render(request)

    # Simulate a prior attempt already consumed.
    store.lease_next_job(worker_id="w", lease_seconds=0)
    job = store.get_job("job_000001", request_id="t").model_copy(
        update={"attempt_count": 1}
    )
    store._save_job(job, clear_lease=False)
    out = process_one_job(
        store,
        worker_id="w2",
        lease_seconds=60,
        backend=Counting(),
        asset_store=FilesystemAssetStore(tmp_path / "a"),
    ).job
    assert out is not None and out.error is not None
    assert out.error.code == "max_attempts_exceeded" and calls == []


def test_cancelled_while_rendering_is_not_overwritten(tmp_path: Path) -> None:
    store, service, root = _setup(tmp_path)
    job_id = _concept_job(service)

    class CancelsMidRender(FakeRenderBackend):
        def render(self, request: RenderRequest) -> RenderedImage:
            service.cancel_job(job_id)
            return super().render(request)

    out = process_one_job(
        store,
        worker_id="w",
        lease_seconds=60,
        backend=CancelsMidRender(),
        asset_store=FilesystemAssetStore(root),
    ).job
    assert out is not None and out.status == "cancelled"


def test_concept_job_requires_asset_store(tmp_path: Path) -> None:
    store, service, _ = _setup(tmp_path)
    _concept_job(service)
    with pytest.raises(ValueError):
        process_one_job(store, worker_id="w", lease_seconds=60)


def test_lease_renewal(tmp_path: Path) -> None:
    store, service, _ = _setup(tmp_path)
    job_id = _concept_job(service)
    store.lease_next_job(worker_id="w", lease_seconds=60)
    assert store.renew_lease(job_id, worker_id="w", lease_seconds=120) is True
    assert store.renew_lease(job_id, worker_id="other", lease_seconds=120) is False


def test_run_worker_once_with_fake_backend_env(tmp_path: Path) -> None:
    settings = Settings(
        CURALINA_DATABASE_URL=f"sqlite:///{tmp_path / 'r.sqlite3'}",
        CURALINA_DATA_DIR=str(tmp_path),
        CURALINA_RENDER_BACKEND="fake",
    )
    store = SQLiteRoomStore.from_database_url(settings.curalina_database_url)
    store.initialize()
    store.seed_from_fixtures()
    job_id = _concept_job(RoomsContractService(store))
    assert run_worker_once(settings) == 0
    done = store.get_job(job_id, request_id="t")
    assert done.status == "succeeded" and done.result is not None
    assert (tmp_path / "assets" / f"{done.result.output_asset_id}.png").is_file()
    assert isinstance(build_render_backend(settings), FakeRenderBackend)


def test_settings_defaults_and_lease_validation() -> None:
    s = Settings()
    assert s.curalina_render_timeout_seconds == 1500
    assert s.curalina_job_timeout_seconds > s.curalina_render_timeout_seconds
    assert s.curalina_room_renderer == "sd15" and s.curalina_render_backend == "http"
    assert s.curalina_renderer_sd15_url == "http://sd15_renderer:8104"
    assert s.curalina_renderer_composite_url == "http://composite_renderer:8105"
    with pytest.raises(ValueError):
        Settings(CURALINA_JOB_TIMEOUT_SECONDS=100, CURALINA_RENDER_TIMEOUT_SECONDS=200)


# --- HTTP backend ----------------------------------------------------------


def _request(renderer: str = "sd15") -> RenderRequest:
    return RenderRequest(
        prompt="p",
        negative_prompt="n",
        width=512,
        height=512,
        seed=3,
        renderer=renderer,
        room_type="living room",
        style="japandi",
        atmosphere="warm",
        pattern=None,
    )


def _http(handler: Callable[[httpx.Request], httpx.Response]) -> HttpRenderBackend:
    return HttpRenderBackend(
        urls={"sd15": "http://sd15:8104/", "composite": "http://comp:8105"},
        timeout_seconds=5,
        client=httpx.Client(transport=httpx.MockTransport(handler)),
    )


def test_http_backend_success_and_headers() -> None:
    seen: dict[str, Any] = {}
    png = make_png(64, 64, (1, 1, 1))

    def handler(request: httpx.Request) -> httpx.Response:
        seen["url"] = str(request.url)
        seen["body"] = json.loads(request.content)
        return httpx.Response(
            200,
            content=png,
            headers={
                "content-type": "image/png",
                "X-Renderer": "sd15",
                "X-Model-Id": "runwayml/x",
                "X-Elapsed-Ms": "1234",
                "X-Label": "AI concept",
            },
        )

    out = _http(handler).render(_request())
    assert out.png_bytes == png and out.renderer == "sd15"
    assert out.model_id == "runwayml/x" and out.elapsed_ms == 1234
    assert out.label == "AI concept"
    assert seen["url"] == "http://sd15:8104/v1/render"
    assert seen["body"] == {
        "schema_version": "1.0",
        "prompt": "p",
        "negative_prompt": "n",
        "width": 512,
        "height": 512,
        "seed": 3,
        "brief": {
            "room_type": "living room",
            "style": "japandi",
            "atmosphere": "warm",
            "pattern": None,
        },
    }
    routed: list[str] = []
    _http(
        lambda r: (routed.append(r.url.host), httpx.Response(200, content=png))[1]
    ).render(_request("composite"))
    assert routed == ["comp"]


def test_http_backend_bad_elapsed_header_defaults() -> None:
    out = _http(
        lambda r: httpx.Response(200, content=b"x", headers={"X-Elapsed-Ms": "zz"})
    ).render(_request())
    assert out.elapsed_ms == 0


def test_http_backend_5xx_uses_body_retryable() -> None:
    def handler(_: httpx.Request) -> httpx.Response:
        return httpx.Response(
            503, json={"code": "model_loading", "message": "wait", "retryable": True}
        )

    with pytest.raises(RenderBackendError) as exc:
        _http(handler).render(_request())
    assert exc.value.code == "renderer_server_error" and exc.value.retryable is True
    assert exc.value.details["renderer_code"] == "model_loading"

    with pytest.raises(RenderBackendError) as exc2:
        _http(lambda r: httpx.Response(500, text="oops")).render(_request())
    assert exc2.value.code == "renderer_server_error" and exc2.value.retryable


def test_http_backend_4xx_is_rejected_not_retryable() -> None:
    with pytest.raises(RenderBackendError) as exc:
        _http(lambda r: httpx.Response(422, json={"code": "bad"})).render(_request())
    assert exc.value.code == "renderer_rejected_request" and not exc.value.retryable


def test_http_backend_timeout_and_unreachable() -> None:
    def timeout(request: httpx.Request) -> httpx.Response:
        raise httpx.ReadTimeout("slow", request=request)

    def refused(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("refused", request=request)

    with pytest.raises(RenderBackendError) as t:
        _http(timeout).render(_request())
    assert t.value.code == "renderer_timeout" and t.value.retryable
    with pytest.raises(RenderBackendError) as u:
        _http(refused).render(_request())
    assert u.value.code == "renderer_unreachable" and u.value.retryable


def test_http_backend_unknown_renderer() -> None:
    backend = HttpRenderBackend(urls={}, timeout_seconds=1)
    with pytest.raises(RenderBackendError):
        backend.render(_request())


def test_worker_with_http_backend_invalid_body_fails_job(tmp_path: Path) -> None:
    store, service, root = _setup(tmp_path)
    _concept_job(service)
    backend = _http(lambda r: httpx.Response(200, content=b"<html>", headers={}))
    job = process_one_job(
        store,
        worker_id="w",
        lease_seconds=60,
        backend=backend,
        asset_store=FilesystemAssetStore(root),
    ).job
    assert job is not None and job.status == "failed"
    assert job.error is not None and job.error.code == "renderer_invalid_image"
    assert _files(root) == []


def test_heartbeat_renews_lease_and_survives_store_errors(tmp_path: Path) -> None:
    import time

    from curalina_rooms.workers.concept_render import _Heartbeat

    store, service, _ = _setup(tmp_path)
    job_id = _concept_job(service)
    store.lease_next_job(worker_id="w", lease_seconds=1)
    beat = _Heartbeat(store, job_id, "w", 3600)
    beat._interval = 0.02
    with beat:
        time.sleep(0.15)
    # Lease was extended far past the original 1s, so nobody else can lease it.
    assert store.lease_next_job(worker_id="other", lease_seconds=60) is None

    class Broken(SQLiteRoomStore):
        def renew_lease(
            self, job_id: str, *, worker_id: str, lease_seconds: int
        ) -> bool:
            raise RuntimeError("db locked")

    bad = _Heartbeat(Broken(store.db_path), job_id, "w", 60)
    bad._interval = 0.02
    with bad:
        time.sleep(0.1)
