from __future__ import annotations

import io
import json
from pathlib import Path
from typing import Any

from fastapi.testclient import TestClient
from PIL import Image

from curalina_composite.app import create_app
from curalina_composite.catalogue import classify, scan
from curalina_composite.render import prepare_cutout
from curalina_composite.schemas import LABEL

BODY: dict[str, Any] = {
    "schema_version": "1.0",
    "prompt": "a room",
    "negative_prompt": None,
    "width": 400,
    "height": 300,
    "seed": 3,
    "brief": {
        "room_type": "Living Room",
        "style": "Organic Modern",
        "atmosphere": "Bright & Airy",
        "pattern": None,
    },
}


def _cutout(path: Path, color: tuple[int, int, int], opaque: bool = False) -> None:
    """RGBA fixture: transparent border, gradient body, one semi-transparent px."""
    path.parent.mkdir(parents=True, exist_ok=True)
    im = Image.new("RGBA", (60, 40), (0, 0, 0, 0))
    for x in range(5, 55):
        for y in range(5, 35):
            im.putpixel((x, y), (color[0], (color[1] + x * 3) % 256, y * 5, 255))
    im.putpixel((5, 5), (255, 0, 0, 128))
    if opaque:
        im = Image.new("RGBA", (60, 40), (255, 255, 255, 255))
    im.save(path)


def _catalogue(root: Path) -> None:
    lux = root / "LUXUS" / "Product Images"
    _cutout(lux / "001 - Grand Sofa" / "a.png", (10, 20, 30))
    _cutout(lux / "002 - Cloud Sofa" / "a.png", (90, 20, 30))
    _cutout(lux / "003 - Accent Chair" / "a.png", (40, 60, 30))
    _cutout(lux / "004 - Coffee Table" / "a.png", (40, 60, 90))
    _cutout(lux / "005 - Side Table" / "a.png", (140, 60, 90))
    art = root / "CELADON" / "001 - Sunrise - SKU1"
    _cutout(art / "a.png", (200, 100, 50), opaque=True)
    _cutout(root / "ATRIANI" / "x" / "a.png", (1, 1, 1))  # must be ignored


def test_classify() -> None:
    assert classify("012 - Velvet Sofa") == "sofa"
    assert classify("Corner Sectional") == "sectional"
    assert classify("Dining Chair Oak") == "dining_chair"
    assert classify("Dining Table") == "dining_table"
    assert classify("King Bed") == "bed"
    assert classify("Bedside Nightstand") == "nightstand"
    assert classify("Lamp") is None


def test_scan_ignores_atriani(tmp_path: Path) -> None:
    _catalogue(tmp_path)
    found = scan(tmp_path)
    assert len(found["sofa"]) == 2 and len(found["art"]) == 1
    assert all("ATRIANI" not in p.name for v in found.values() for p in v)


def test_headers_label_and_pieces(tmp_path: Path) -> None:
    _catalogue(tmp_path)
    r = TestClient(create_app(tmp_path)).post("/v1/render", json=BODY)
    assert r.status_code == 200
    assert r.headers["content-type"] == "image/png"
    assert r.headers["x-renderer"] == "composite"
    assert r.headers["x-label"] == LABEL
    assert int(r.headers["x-elapsed-ms"]) >= 0
    assert r.headers["x-model-id"]
    pieces = json.loads(r.headers["x-pieces"])
    assert any(p.startswith("LUXUS/") for p in pieces)
    assert "CELADON/001 - Sunrise - SKU1" in pieces
    assert Image.open(io.BytesIO(r.content)).size == (400, 300)


def test_deterministic_same_seed(tmp_path: Path) -> None:
    _catalogue(tmp_path)
    c = TestClient(create_app(tmp_path))
    a = c.post("/v1/render", json=BODY)
    b = c.post("/v1/render", json=BODY)
    assert a.content == b.content
    assert a.headers["x-pieces"] == b.headers["x-pieces"]
    no_seed = {**BODY, "seed": None}
    assert (
        c.post("/v1/render", json=no_seed).content
        == c.post("/v1/render", json=no_seed).content
    )


def test_seed_changes_choice(tmp_path: Path) -> None:
    _catalogue(tmp_path)
    c = TestClient(create_app(tmp_path))
    sofas: set[str] = set()
    for s in range(12):
        h = c.post("/v1/render", json={**BODY, "seed": s}).headers["x-pieces"]
        sofas.update(p for p in json.loads(h) if "Sofa" in p)
    assert len(sofas) == 2


def test_pasted_pixels_are_original(tmp_path: Path) -> None:
    """Only a sofa exists, so nothing overlaps it; opaque pixels must equal source."""
    lux = tmp_path / "LUXUS" / "Product Images"
    src = lux / "001 - Grand Sofa" / "a.png"
    _cutout(src, (10, 20, 30))
    r = TestClient(create_app(tmp_path)).post("/v1/render", json=BODY)
    assert r.status_code == 200
    canvas = Image.open(io.BytesIO(r.content)).convert("RGB")

    from curalina_composite.catalogue import scan as _scan
    from curalina_composite.render import build_placements
    from curalina_composite.scene import Geometry

    (placement,) = build_placements(
        _scan(tmp_path), "Living Room", Geometry(400, 300), 3
    )
    expected = prepare_cutout(Image.open(src), placement.image.width, 10_000)
    assert expected.tobytes() == placement.image.tobytes()
    alpha = placement.image.getchannel("A")
    checked = 0
    for x in range(placement.image.width):
        for y in range(placement.image.height):
            if alpha.getpixel((x, y)) == 255:
                cx, cy = placement.left + x, placement.top + y
                expected_px = placement.image.convert("RGB").getpixel((x, y))
                assert canvas.getpixel((cx, cy)) == expected_px
                checked += 1
    assert checked > 100


def test_no_images_error(tmp_path: Path) -> None:
    r = TestClient(create_app(tmp_path / "missing")).post("/v1/render", json=BODY)
    assert r.status_code == 503
    assert r.json() == {
        "code": "no_catalogue_images",
        "message": r.json()["message"],
        "retryable": False,
    }


def test_partial_catalogue_still_renders(tmp_path: Path) -> None:
    _cutout(tmp_path / "CELADON" / "1 - Art - S" / "a.png", (1, 2, 3), opaque=True)
    r = TestClient(create_app(tmp_path)).post("/v1/render", json=BODY)
    assert r.status_code == 200
    assert json.loads(r.headers["x-pieces"]) == ["CELADON/1 - Art - S"]


def test_opaque_furniture_is_not_used(tmp_path: Path) -> None:
    lux = tmp_path / "LUXUS" / "Product Images"
    _cutout(lux / "001 - Grand Sofa" / "a.png", (1, 1, 1), opaque=True)
    r = TestClient(create_app(tmp_path)).post("/v1/render", json=BODY)
    assert r.status_code == 503


def test_other_rooms_and_moods(tmp_path: Path) -> None:
    lux = tmp_path / "LUXUS" / "Product Images"
    for n, name in enumerate(
        [
            "King Bed",
            "Nightstand",
            "Storage Bench",
            "Dining Table",
            "Dining Chair",
            "Sideboard",
        ]
    ):
        _cutout(lux / f"{n} - {name}" / "a.png", (n * 20, 5, 5))
    c = TestClient(create_app(tmp_path))
    for room, style, mood in [
        ("Bedroom", "Contemporary Luxe", "Dark & Moody"),
        ("Dining Room", "Mid-Century Scandinavian", "Warm & Balanced"),
    ]:
        brief = {"room_type": room, "style": style, "atmosphere": mood}
        r = c.post("/v1/render", json={**BODY, "brief": brief})
        assert r.status_code == 200, r.text
        assert len(json.loads(r.headers["x-pieces"])) >= 3


def test_palettes_differ(tmp_path: Path) -> None:
    _catalogue(tmp_path)
    c = TestClient(create_app(tmp_path))
    imgs = []
    for mood in ("Bright & Airy", "Warm & Balanced", "Dark & Moody"):
        brief = {**BODY["brief"], "atmosphere": mood}
        imgs.append(c.post("/v1/render", json={**BODY, "brief": brief}).content)
    assert len(set(imgs)) == 3


def test_unsupported_brief_values_are_422(tmp_path: Path) -> None:
    _catalogue(tmp_path)
    c = TestClient(create_app(tmp_path))
    for key, val, code in [
        ("room_type", "Garage", "unsupported_room_type"),
        ("style", "Baroque", "unsupported_style"),
        ("atmosphere", "Neon", "unsupported_atmosphere"),
    ]:
        r = c.post("/v1/render", json={**BODY, "brief": {**BODY["brief"], key: val}})
        assert r.status_code == 422 and r.json()["code"] == code


def test_schema_error_flat_422(tmp_path: Path) -> None:
    r = TestClient(create_app(tmp_path)).post("/v1/render", json={**BODY, "width": 1})
    assert r.status_code == 422
    assert set(r.json()) == {"code", "message", "retryable"}


def test_healthz(tmp_path: Path) -> None:
    ok = TestClient(create_app(tmp_path)).get("/healthz")
    assert ok.json() == {"status": "ok", "renderer": "composite", "ready": True}
    missing = TestClient(create_app(tmp_path / "nope")).get("/healthz")
    assert missing.status_code == 200 and missing.json()["ready"] is False


def test_matte_removes_white_background_but_keeps_interior_white() -> None:
    from PIL import Image as _I

    from curalina_composite.matting import matte_white_background

    img = _I.new("RGBA", (40, 40), (255, 255, 255, 255))  # opaque white studio bg
    for x in range(10, 30):
        for y in range(10, 30):
            img.putpixel((x, y), (30, 60, 90, 255))  # product body
    for x in range(18, 22):
        for y in range(18, 22):
            img.putpixel((x, y), (255, 255, 255, 255))  # white detail inside product
    out = matte_white_background(img)
    assert out.getpixel((0, 0))[3] == 0
    assert out.getpixel((20, 20))[3] == 255
    assert out.getpixel((12, 12)) == (30, 60, 90, 255)
