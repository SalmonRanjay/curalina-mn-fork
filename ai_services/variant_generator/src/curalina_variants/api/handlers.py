"""Contract-level request handlers for the variant-generator `/v1` surface.

A1 is contract-only: these handlers are plain callables (not ASGI routes) so
contract tests can exercise status codes, error shapes and the job state
machine without a running FastAPI app or SQLite database. Wiring these into
a real loopback API and swapping `FakeJobStore` for a durable store is A3
scope, per `agentic_flow/variant_generator_workflow.md`.

Every handler returns an `ApiResponse` (2xx path) or raises `ApiError` (4xx
path, per `errors.py`'s canonical vocabulary). No handler ever lets an
unexpected exception escape as a 500 with details opaque to the caller;
`dispatch` is the single seam a future ASGI adapter would wrap.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, TypeVar

from pydantic import BaseModel, ValidationError

from curalina_variants.api.errors import (
    ApiError,
    unsupported_version_error,
    validation_error,
)
from curalina_variants.api.schemas import (
    SUPPORTED_SCHEMA_MAJOR,
    CreateAssetRequest,
    CreateReviewRequest,
    CreateVariantJobRequest,
)
from curalina_variants.api.store import FakeJobStore

RequestModelT = TypeVar("RequestModelT", bound=BaseModel)


@dataclass(frozen=True)
class ApiResponse:
    status_code: int
    body: Any
    headers: dict[str, str]


def check_schema_version(payload: dict[str, Any], *, request_id: str) -> None:
    """Reject unsupported major versions with 422 before any field-level
    validation runs, per `03_data_contracts.md`: "Reject unsupported major
    versions with 422."."""

    raw = payload.get("schema_version", "1.0")
    if not isinstance(raw, str) or "." not in raw:
        raise unsupported_version_error(request_id, received=str(raw))
    major_str = raw.split(".", 1)[0]
    try:
        major = int(major_str)
    except ValueError as exc:
        raise unsupported_version_error(request_id, received=raw) from exc
    if major != SUPPORTED_SCHEMA_MAJOR:
        raise unsupported_version_error(request_id, received=raw)


def _validated(
    model_cls: type[RequestModelT], payload: dict[str, Any], *, request_id: str
) -> RequestModelT:
    """Construct a request DTO, turning a pydantic ValidationError into a
    structured 422 `ApiError` instead of letting it propagate as a 500."""

    check_schema_version(payload, request_id=request_id)
    try:
        return model_cls.model_validate(payload)
    except ValidationError as exc:
        missing = [
            ".".join(str(part) for part in error["loc"])
            for error in exc.errors()
            if error["type"] == "missing"
        ]
        message = (
            f"Missing required field(s): {', '.join(missing)}"
            if missing
            else "Request payload failed validation"
        )
        raise validation_error(
            request_id,
            message=message,
            details={"errors": exc.errors(include_url=False, include_context=False)},
        ) from exc


def create_asset(
    store: FakeJobStore,
    payload: dict[str, Any],
    *,
    request_id: str,
) -> ApiResponse:
    request = _validated(CreateAssetRequest, payload, request_id=request_id)
    record = store.create_asset(request, request_id=request_id)
    return ApiResponse(status_code=201, body=record, headers={})


def get_asset_content(
    store: FakeJobStore, asset_id: str, *, request_id: str
) -> ApiResponse:
    content = store.get_asset_content(asset_id, request_id=request_id)
    return ApiResponse(status_code=200, body=content, headers={})


def create_variant_job(
    store: FakeJobStore,
    payload: dict[str, Any],
    *,
    idempotency_key: str,
    request_id: str,
) -> ApiResponse:
    request = _validated(CreateVariantJobRequest, payload, request_id=request_id)
    job, _created = store.create_variant_job(
        request, idempotency_key=idempotency_key, request_id=request_id
    )
    return ApiResponse(
        status_code=202,
        body=job,
        headers={"Location": f"/v1/jobs/{job.job_id}"},
    )


def get_job(store: FakeJobStore, job_id: str, *, request_id: str) -> ApiResponse:
    job = store.get_job(job_id, request_id=request_id)
    return ApiResponse(status_code=200, body=job, headers={})


def cancel_job(store: FakeJobStore, job_id: str, *, request_id: str) -> ApiResponse:
    job = store.cancel_job(job_id, request_id=request_id)
    return ApiResponse(status_code=200, body=job, headers={})


def create_review(
    store: FakeJobStore,
    candidate_id: str,
    payload: dict[str, Any],
    *,
    request_id: str,
) -> ApiResponse:
    request = _validated(CreateReviewRequest, payload, request_id=request_id)
    review = store.create_review(candidate_id, request, request_id=request_id)
    return ApiResponse(status_code=201, body=review, headers={})


__all__ = [
    "ApiError",
    "ApiResponse",
    "cancel_job",
    "check_schema_version",
    "create_asset",
    "create_review",
    "create_variant_job",
    "get_asset_content",
    "get_job",
]
