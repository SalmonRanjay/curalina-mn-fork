from __future__ import annotations

import io
from typing import Any

from fastapi.testclient import TestClient
from PIL import Image

from curalina_sd15.app import create_app
from curalina_sd15.pipeline import Pipeline, Settings
from curalina_sd15.schemas import LABEL

BODY: dict[str, Any] = {
    "schema_version": "1.0",
    "prompt": "a room",
    "negative_prompt": None,
    "width": 256,
    "height": 320,
    "seed": 7,
    "brief": {
        "room_type": "Living Room",
        "style": "Organic Modern",
        "atmosphere": "Warm & Balanced",
        "pattern": None,
    },
}


class FakePipeline:
    def __init__(self, calls: list[tuple[Any, ...]]) -> None:
        self.calls = calls

    def generate(
        self,
        prompt: str,
        negative_prompt: str | None,
        width: int,
        height: int,
        seed: int | None,
    ) -> Image.Image:
        self.calls.append((prompt, negative_prompt, width, height, seed))
        return Image.new("RGB", (width, height), (10, 20, 30))


class FakeFactory:
    def __init__(self) -> None:
        self.builds = 0
        self.calls: list[tuple[Any, ...]] = []

    def build(self, settings: Settings) -> Pipeline:
        self.builds += 1
        return FakePipeline(self.calls)


class BoomFactory:
    def build(self, settings: Settings) -> Pipeline:
        raise RuntimeError("no weights")


def test_healthz_not_ready_until_first_render_and_lazy() -> None:
    f = FakeFactory()
    c = TestClient(create_app(f, Settings()))
    r = c.get("/healthz")
    assert r.status_code == 200
    assert r.json() == {"status": "ok", "renderer": "sd15", "ready": False}
    assert f.builds == 0
    assert c.post("/v1/render", json=BODY).status_code == 200
    assert c.get("/healthz").json()["ready"] is True
    c.post("/v1/render", json=BODY)
    assert f.builds == 1


def test_render_png_and_headers() -> None:
    f = FakeFactory()
    c = TestClient(create_app(f, Settings(model_id="m/x")))
    r = c.post("/v1/render", json=BODY)
    assert r.headers["content-type"] == "image/png"
    assert r.headers["x-renderer"] == "sd15"
    assert r.headers["x-model-id"] == "m/x"
    assert r.headers["x-label"] == LABEL
    assert int(r.headers["x-elapsed-ms"]) >= 0
    img = Image.open(io.BytesIO(r.content))
    assert img.format == "PNG" and img.size == (256, 320)
    assert f.calls == [("a room", None, 256, 320, 7)]


def test_schema_error_is_flat_422() -> None:
    c = TestClient(create_app(FakeFactory(), Settings()))
    patches = (
        {"width": 100},
        {"width": 259},
        {"schema_version": "2.0"},
        {"prompt": ""},
    )
    for patch in patches:
        r = c.post("/v1/render", json={**BODY, **patch})
        assert r.status_code == 422
        assert set(r.json()) == {"code", "message", "retryable"}
        assert r.json()["retryable"] is False


def test_model_load_failure_is_503_not_image() -> None:
    c = TestClient(create_app(BoomFactory(), Settings()))
    r = c.post("/v1/render", json=BODY)
    assert r.status_code == 503
    assert r.json()["code"] == "model_unavailable" and r.json()["retryable"] is True
    assert c.get("/healthz").json()["ready"] is False


def test_render_failure_is_500() -> None:
    class Bad:
        def build(self, settings: Settings) -> Pipeline:
            class P:
                def generate(self, *a: object) -> Image.Image:
                    raise ValueError("oom")

            return P()  # type: ignore[return-value,unused-ignore]

    r = TestClient(create_app(Bad(), Settings())).post("/v1/render", json=BODY)
    assert r.status_code == 500 and r.json()["code"] == "render_failed"


def test_settings_from_env() -> None:
    env = {"SD15_MODEL_ID": "a/b", "SD15_STEPS": "5", "SD15_GUIDANCE": "3"}
    s = Settings.from_env(env)
    assert (s.model_id, s.steps, s.guidance) == ("a/b", 5, 3.0)
    assert Settings.from_env({}).steps == 20


def test_package_imports_without_torch() -> None:
    import sys

    import curalina_sd15.pipeline  # noqa: F401

    assert "torch" not in sys.modules


def test_lora_settings_and_trigger() -> None:
    from curalina_sd15.pipeline import Settings, apply_trigger, model_label

    off = Settings.from_env({})
    assert off.lora_path is None
    assert apply_trigger("a room", off) == "a room"
    assert model_label(off) == off.model_id

    on = Settings.from_env({"SD15_LORA_PATH": "/lora", "SD15_LORA_SCALE": "0.8"})
    assert on.lora_scale == 0.8
    assert apply_trigger("a bright room", on) == "crlnstyle, a bright room"
    twice = apply_trigger("crlnstyle, a room", on)
    assert twice == "crlnstyle, a room"  # not duplicated
    assert model_label(on).endswith("+lora")
