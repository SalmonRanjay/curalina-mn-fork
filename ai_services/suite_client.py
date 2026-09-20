"""Local HTTP-only suite runner for the Python AI services.

The runner is an orchestration convenience. It starts service processes with
explicit local settings, talks to public `/v1` HTTP endpoints, and never imports
service packages or reads service-local SQLite files.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import socket
import subprocess
import sys
import tempfile
import time
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parent
READY_SERVICES = ("recommendation", "variants", "rooms")
DEFERRED_SERVICES: tuple[str, ...] = ()
HTTP_TIMEOUT_SECONDS = 3.0
STARTUP_TIMEOUT_SECONDS = 15.0


class SuiteError(RuntimeError):
    """Raised for a named suite mismatch or process failure."""


@dataclass(frozen=True, slots=True)
class ServiceSpec:
    name: str
    package_dir: Path
    module: str
    port: int
    database_name: str

    @property
    def base_url(self) -> str:
        return f"http://127.0.0.1:{self.port}"


@dataclass(slots=True)
class RunningService:
    spec: ServiceSpec
    process: subprocess.Popen[str]


SERVICE_SPECS = {
    "recommendation": ServiceSpec(
        name="recommendation",
        package_dir=ROOT / "recommendation",
        module="curalina_recommendation.bootstrap",
        port=8101,
        database_name="recommendation.sqlite3",
    ),
    "variants": ServiceSpec(
        name="variants",
        package_dir=ROOT / "variant_generator",
        module="curalina_variants.bootstrap",
        port=8102,
        database_name="variants.sqlite3",
    ),
    "rooms": ServiceSpec(
        name="rooms",
        package_dir=ROOT / "room_generator",
        module="curalina_rooms.bootstrap",
        port=8103,
        database_name="rooms.sqlite3",
    ),
}


def _json_request(
    method: str,
    url: str,
    *,
    payload: Mapping[str, Any] | None = None,
    headers: Mapping[str, str] | None = None,
) -> dict[str, Any]:
    body = None if payload is None else json.dumps(payload).encode("utf-8")
    request = Request(
        url,
        data=body,
        method=method,
        headers={
            "Accept": "application/json",
            "Content-Type": "application/json",
            **dict(headers or {}),
        },
    )
    try:
        with urlopen(request, timeout=HTTP_TIMEOUT_SECONDS) as response:
            raw = response.read().decode("utf-8")
            return json.loads(raw) if raw else {}
    except HTTPError as exc:
        details = exc.read().decode("utf-8")
        raise SuiteError(f"{method} {url} returned {exc.code}: {details}") from exc
    except URLError as exc:
        raise SuiteError(f"{method} {url} failed: {exc.reason}") from exc


def _require_field(
    service: str, endpoint: str, body: Mapping[str, Any], field: str
) -> Any:
    if field not in body:
        raise SuiteError(f"{service} {endpoint} missing response field: {field}")
    return body[field]


def _require_equal(
    service: str, endpoint: str, field: str, actual: object, expected: object
) -> None:
    if actual != expected:
        raise SuiteError(
            f"{service} {endpoint} field {field} mismatch: "
            f"expected {expected!r}, got {actual!r}"
        )


def _require_prefixed(
    service: str, endpoint: str, field: str, value: object, prefix: str
) -> str:
    if not isinstance(value, str) or not value.startswith(prefix):
        raise SuiteError(
            f"{service} {endpoint} field {field} must start with {prefix!r}; "
            f"got {value!r}"
        )
    return value


def _port_is_open(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.settimeout(0.25)
        return sock.connect_ex(("127.0.0.1", port)) == 0


def _assert_port_free(spec: ServiceSpec) -> None:
    if _port_is_open(spec.port):
        raise SuiteError(
            f"{spec.name} port {spec.port} is already occupied; "
            "run-suite requires explicit local service ownership"
        )


def _service_env(spec: ServiceSpec, data_dir: Path) -> dict[str, str]:
    env = dict(os.environ)
    env["CURALINA_ENV"] = "suite"
    env["CURALINA_DATA_DIR"] = str(data_dir)
    env["CURALINA_DATABASE_URL"] = f"sqlite:///{data_dir / spec.database_name}"
    env["SERVICE_HOST"] = "127.0.0.1"
    env["SERVICE_PORT"] = str(spec.port)
    env["PYTHONPATH"] = str(spec.package_dir / "src")
    env["PYTHONDONTWRITEBYTECODE"] = "1"
    return env


def _start_service(spec: ServiceSpec, data_dir: Path) -> RunningService:
    _assert_port_free(spec)
    process = subprocess.Popen(
        [sys.executable, "-m", spec.module],
        cwd=spec.package_dir,
        env=_service_env(spec, data_dir),
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    return RunningService(spec=spec, process=process)


def _stop_services(services: Sequence[RunningService]) -> None:
    for service in services:
        if service.process.poll() is None:
            service.process.terminate()
    deadline = time.monotonic() + 5.0
    for service in services:
        remaining = max(0.1, deadline - time.monotonic())
        try:
            service.process.wait(timeout=remaining)
        except subprocess.TimeoutExpired:
            service.process.kill()
            service.process.wait(timeout=2.0)


def _process_tail(process: subprocess.Popen[str]) -> str:
    stderr = ""
    if process.stderr is not None:
        try:
            stderr = process.stderr.read()
        except OSError:
            stderr = ""
    return stderr.strip()


def _wait_for_service(service: RunningService) -> None:
    deadline = time.monotonic() + STARTUP_TIMEOUT_SECONDS
    url = f"{service.spec.base_url}/openapi.json"
    while time.monotonic() < deadline:
        if service.process.poll() is not None:
            raise SuiteError(
                f"{service.spec.name} exited before health check; "
                f"stderr={_process_tail(service.process)!r}"
            )
        try:
            _json_request("GET", url)
            return
        except SuiteError:
            time.sleep(0.2)
    raise SuiteError(f"{service.spec.name} health check timed out at {url}")


def _run_variant_worker(data_dir: Path) -> None:
    spec = SERVICE_SPECS["variants"]
    result = subprocess.run(
        [sys.executable, "-m", "curalina_variants.bootstrap", "worker"],
        cwd=spec.package_dir,
        env=_service_env(spec, data_dir),
        text=True,
        capture_output=True,
        check=False,
    )
    if result.returncode != 0:
        raise SuiteError(
            "variants worker failed to process one queued job; "
            f"exit={result.returncode}, stderr={result.stderr.strip()!r}"
        )


def _run_rooms_worker(data_dir: Path) -> None:
    spec = SERVICE_SPECS["rooms"]
    result = subprocess.run(
        [sys.executable, "-m", "curalina_rooms.bootstrap", "worker"],
        cwd=spec.package_dir,
        env=_service_env(spec, data_dir),
        text=True,
        capture_output=True,
        check=False,
    )
    if result.returncode != 0:
        raise SuiteError(
            "rooms worker failed to process one queued job; "
            f"exit={result.returncode}, stderr={result.stderr.strip()!r}"
        )


def _recommendation_flow(base_url: str) -> tuple[str, int, str, str]:
    endpoint = "/v1/catalogue/imports"
    imported = _json_request(
        "POST",
        f"{base_url}{endpoint}",
        payload={
            "schema_version": "1.0",
            "source_uri": "suite://synthetic-a3-catalogue",
            "supplier_id": "supplier_curated_001",
        },
    )
    _require_equal(
        "recommendation",
        endpoint,
        "schema_version",
        imported.get("schema_version"),
        "1.0",
    )
    snapshot_id = _require_prefixed(
        "recommendation",
        endpoint,
        "snapshot_id",
        _require_field("recommendation", endpoint, imported, "snapshot_id"),
        "snap_",
    )
    report = _require_field("recommendation", endpoint, imported, "report")
    if not isinstance(report, dict) or report.get("products_imported", 0) <= 0:
        raise SuiteError(
            "recommendation /v1/catalogue/imports field report.products_imported "
            f"must be positive; got {report!r}"
        )

    profile = {
        "room_type": "living_room",
        "style": "organic_modern",
        "atmosphere": "warm_balanced",
        "categories": ["sofa", "wall_art"],
        "furniture_budget_minor_units": 200000,
        "currency": "CAD",
    }
    endpoint = "/v1/recommendations"
    recommendations = _json_request(
        "POST",
        f"{base_url}{endpoint}",
        payload={
            "schema_version": "1.0",
            "catalogue_snapshot_id": snapshot_id,
            "profile": profile,
        },
    )
    _require_equal(
        "recommendation",
        endpoint,
        "catalogue_snapshot_id",
        recommendations.get("catalogue_snapshot_id"),
        snapshot_id,
    )
    candidates = _require_field(
        "recommendation", endpoint, recommendations, "candidates"
    )
    if not isinstance(candidates, list) or not candidates:
        raise SuiteError("recommendation /v1/recommendations returned no candidates")

    endpoint = "/v1/bundles"
    bundle = _json_request(
        "POST",
        f"{base_url}{endpoint}",
        payload={
            "schema_version": "1.0",
            "catalogue_snapshot_id": snapshot_id,
            "rules_version": "rules_2024_01",
            "profile": profile,
        },
    )
    bundle_id = _require_prefixed(
        "recommendation",
        endpoint,
        "bundle_id",
        _require_field("recommendation", endpoint, bundle, "bundle_id"),
        "bundle_",
    )
    revision = _require_field("recommendation", endpoint, bundle, "revision")
    if not isinstance(revision, int) or revision < 1:
        raise SuiteError(
            f"recommendation /v1/bundles field revision invalid: {revision!r}"
        )
    if bundle.get("feasible") is True:
        raise SuiteError(
            "recommendation /v1/bundles must not claim feasibility while "
            f"R03 is logic-only: {bundle!r}"
        )
    violations = _require_field("recommendation", endpoint, bundle, "violations")
    if not isinstance(violations, list) or not any(
        isinstance(item, dict)
        and item.get("code") == "needs_input:furniture_catalogue:OQ-011"
        for item in violations
    ):
        raise SuiteError(
            "recommendation /v1/bundles must carry OQ-011 needs_input "
            f"under logic-only R03 scope: {bundle!r}"
        )
    line_items = _require_field("recommendation", endpoint, bundle, "line_items")
    if not isinstance(line_items, list) or not line_items:
        raise SuiteError("recommendation /v1/bundles returned no line_items")
    first_item = line_items[0]
    if not isinstance(first_item, dict):
        raise SuiteError(
            f"recommendation /v1/bundles line_items[0] invalid: {first_item!r}"
        )
    product_id = _require_prefixed(
        "recommendation",
        endpoint,
        "line_items[0].product_id",
        _require_field(
            "recommendation", endpoint, first_item, "product_id"
        ),
        "prod_",
    )
    return bundle_id, revision, snapshot_id, product_id


def _variants_flow(base_url: str, data_dir: Path, product_id: str) -> tuple[str, str]:
    content = b"suite-fixture-image-bytes-not-real-imagery"
    endpoint = "/v1/assets"
    asset = _json_request(
        "POST",
        f"{base_url}{endpoint}",
        payload={
            "schema_version": "1.0",
            "owner_id": "suite_user",
            "original_filename": "suite-product.png",
            "media_type": "image/png",
            "content_bytes": content.decode("ascii"),
        },
        headers={"X-Request-ID": "req-suite-asset"},
    )
    asset_id = _require_prefixed(
        "variants",
        endpoint,
        "asset_id",
        _require_field("variants", endpoint, asset, "asset_id"),
        "asset_",
    )
    expected_hash = "sha256:" + hashlib.sha256(content).hexdigest()
    _require_equal(
        "variants", endpoint, "content_hash", asset.get("content_hash"), expected_hash
    )

    endpoint = "/v1/jobs"
    job = _json_request(
        "POST",
        f"{base_url}{endpoint}",
        payload={
            "schema_version": "1.0",
            "parent_product_id": product_id,
            "source_asset_id": asset_id,
            "mask_id": "mask_suite_000001",
            "target_colour": "#1B4D3E",
            "owner_id": "suite_user",
        },
        headers={
            "Idempotency-Key": "suite-variant-job-1",
            "X-Request-ID": "req-suite-job",
        },
    )
    job_id = _require_prefixed(
        "variants",
        endpoint,
        "job_id",
        _require_field("variants", endpoint, job, "job_id"),
        "job_",
    )
    _require_equal("variants", endpoint, "status", job.get("status"), "queued")

    _run_variant_worker(data_dir)

    endpoint = f"/v1/jobs/{job_id}"
    completed = _json_request("GET", f"{base_url}{endpoint}")
    _require_equal("variants", endpoint, "status", completed.get("status"), "succeeded")
    candidate_id = _require_prefixed(
        "variants",
        endpoint,
        "candidate_id",
        _require_field("variants", endpoint, completed, "candidate_id"),
        "cand_",
    )

    endpoint = f"/v1/candidates/{candidate_id}/reviews"
    review = _json_request(
        "POST",
        f"{base_url}{endpoint}",
        payload={
            "schema_version": "1.0",
            "reviewer_id": "suite_reviewer",
            "decision": "approved",
            "expected_revision": 1,
        },
        headers={"X-Request-ID": "req-suite-review"},
    )
    _require_equal(
        "variants",
        endpoint,
        "candidate_id",
        review.get("candidate_id"),
        candidate_id,
    )
    _require_equal("variants", endpoint, "revision", review.get("revision"), 2)
    return job_id, candidate_id


# Rooms' fixture-seeded fake store carries exactly one bundle; the render job
# must target it by id and current revision or receive a named
# stale_bundle_revision error, so the suite targets it explicitly rather than
# discovering it over HTTP (rooms exposes no bundle-listing endpoint).
_ROOMS_SEEDED_BUNDLE_ID = "bundle_liv001"
_ROOMS_SEEDED_BUNDLE_REVISION = "rev_002"


def _rooms_import_asset(
    base_url: str,
    *,
    original_filename: str,
    media_type: str,
    content_length: int,
    provenance: str,
) -> tuple[str, str]:
    endpoint = "/v1/assets"
    payload = {
        "schema_version": "1.0",
        "owner_id": "suite_user",
        "original_filename": original_filename,
        "media_type": media_type,
        "content_length": content_length,
        "provenance": provenance,
    }
    asset = _json_request(
        "POST",
        f"{base_url}{endpoint}",
        payload=payload,
        headers={"X-Request-ID": f"req-suite-rooms-asset-{original_filename}"},
    )
    asset_id = _require_prefixed(
        "rooms",
        endpoint,
        "asset_id",
        _require_field("rooms", endpoint, asset, "asset_id"),
        "asset_",
    )
    digest_source = "|".join(
        ["suite_user", original_filename, str(content_length), ""]
    ).encode("utf-8")
    expected_hash = "sha256:" + hashlib.sha256(digest_source).hexdigest()
    _require_equal(
        "rooms", endpoint, "content_hash", asset.get("content_hash"), expected_hash
    )
    return asset_id, expected_hash


def _rooms_flow(
    base_url: str, data_dir: Path, *, product_id: str, variant_candidate_id: str
) -> tuple[str, str]:
    room_asset_id, _ = _rooms_import_asset(
        base_url,
        original_filename="suite-room-photo.jpg",
        media_type="image/jpeg",
        content_length=4096,
        provenance="customer_upload",
    )
    hero_asset_id, _ = _rooms_import_asset(
        base_url,
        original_filename="suite-hero-product.png",
        media_type="image/png",
        content_length=2048,
        provenance=f"variant_export:{variant_candidate_id}",
    )

    endpoint = "/v1/render-jobs"
    render_job = _json_request(
        "POST",
        f"{base_url}{endpoint}",
        payload={
            "schema_version": "1.0",
            "bundle": {
                "bundle_id": _ROOMS_SEEDED_BUNDLE_ID,
                "bundle_revision": _ROOMS_SEEDED_BUNDLE_REVISION,
            },
            "room_type": "living_room",
            "layout_version": "layout_v3",
            "provenance_mode": "synthetic_defaults",
            "instances": [
                {
                    "instance_id": "inst_suite_1",
                    "product_id": product_id,
                    "quantity": 1,
                }
            ],
            "reference_images": [
                {"asset_id": room_asset_id, "role": "room_photo"},
                {"asset_id": hero_asset_id, "role": "hero_product"},
            ],
            "idempotency_key": "suite-render-job-1",
        },
        headers={"X-Request-ID": "req-suite-render-job"},
    )
    job_id = _require_prefixed(
        "rooms",
        endpoint,
        "job_id",
        _require_field("rooms", endpoint, render_job, "job_id"),
        "job_",
    )
    _require_equal("rooms", endpoint, "status", render_job.get("status"), "queued")
    _require_equal(
        "rooms",
        endpoint,
        "bundle_id",
        render_job.get("bundle_id"),
        _ROOMS_SEEDED_BUNDLE_ID,
    )
    _require_equal(
        "rooms",
        endpoint,
        "bundle_revision",
        render_job.get("bundle_revision"),
        _ROOMS_SEEDED_BUNDLE_REVISION,
    )

    _run_rooms_worker(data_dir)

    endpoint = f"/v1/jobs/{job_id}"
    completed = _json_request("GET", f"{base_url}{endpoint}")
    _require_equal("rooms", endpoint, "status", completed.get("status"), "succeeded")
    result = _require_field("rooms", endpoint, completed, "result")
    if not isinstance(result, dict):
        raise SuiteError(f"rooms {endpoint} field result invalid: {result!r}")
    candidate_id = _require_prefixed(
        "rooms",
        endpoint,
        "result.candidate_id",
        _require_field("rooms", endpoint, result, "candidate_id"),
        "cand_",
    )

    endpoint = f"/v1/candidates/{candidate_id}/reviews"
    review = _json_request(
        "POST",
        f"{base_url}{endpoint}",
        payload={
            "schema_version": "1.0",
            "reviewer_id": "suite_reviewer",
            "decision": "approved",
            "expected_revision": 1,
        },
        headers={"X-Request-ID": "req-suite-rooms-review"},
    )
    _require_equal(
        "rooms", endpoint, "candidate_id", review.get("candidate_id"), candidate_id
    )
    _require_equal("rooms", endpoint, "revision", review.get("revision"), 2)
    return job_id, candidate_id


def run_suite() -> int:
    print("suite: starting recommendation, variants and rooms")
    with tempfile.TemporaryDirectory(prefix="curalina-suite-") as temp:
        data_dir = Path(temp)
        services: list[RunningService] = []
        try:
            for name in READY_SERVICES:
                services.append(_start_service(SERVICE_SPECS[name], data_dir))
            for service in services:
                _wait_for_service(service)
                print(f"suite: {service.spec.name} ready at {service.spec.base_url}")

            bundle_id, revision, snapshot_id, product_id = _recommendation_flow(
                SERVICE_SPECS["recommendation"].base_url
            )
            variant_job_id, candidate_id = _variants_flow(
                SERVICE_SPECS["variants"].base_url,
                data_dir,
                product_id=product_id,
            )
            room_job_id, room_candidate_id = _rooms_flow(
                SERVICE_SPECS["rooms"].base_url,
                data_dir,
                product_id=product_id,
                variant_candidate_id=candidate_id,
            )
            print(
                "suite: recommendation->variants->rooms flow passed "
                f"(snapshot={snapshot_id}, bundle={bundle_id}@{revision}, "
                f"variant_job={variant_job_id}, variant_candidate={candidate_id}, "
                f"room_job={room_job_id}, room_candidate={room_candidate_id})"
            )
            return 0
        finally:
            _stop_services(services)


def dry_run() -> int:
    ready = ", ".join(READY_SERVICES)
    if DEFERRED_SERVICES:
        deferred = ", ".join(DEFERRED_SERVICES)
        print(f"suite ready services: {ready}; deferred services: {deferred}")
    else:
        print(f"suite ready services: {ready}; deferred services: none")
    return 0


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Curalina local suite runner")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Report available suite participants without starting services.",
    )
    args = parser.parse_args(argv)
    try:
        return dry_run() if args.dry_run else run_suite()
    except SuiteError as exc:
        print(f"suite error: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
