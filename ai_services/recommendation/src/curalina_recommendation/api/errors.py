"""Shared error vocabulary for the recommendation HTTP surface.

Every error response uses the cross-service shape documented in
`architecture/guides/03_data_contracts.md` and mirrored in
`ai_services/contracts/v1/schemas/error.schema.json`:
``code``, ``message``, ``details``, ``retryable``, ``request_id``.

This module builds that shape and wires it into FastAPI's validation
error handling so that a missing required field or an unsupported
``schema_version`` major surfaces as a structured 422, never a 500.
"""

from __future__ import annotations

import uuid
from typing import Any

from fastapi import Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field

UNSUPPORTED_SCHEMA_VERSION_CODE = "unsupported_schema_version"
INVALID_REQUEST_CODE = "invalid_request"


class CuralinaError(BaseModel):
    """Wire shape for every error response. Matches `error.schema.json`."""

    model_config = ConfigDict(extra="forbid")

    code: str = Field(min_length=1)
    message: str = Field(min_length=1)
    details: dict[str, Any] = Field(default_factory=dict)
    retryable: bool
    request_id: str = Field(min_length=1)


def new_request_id() -> str:
    """A fresh opaque request id. Not tied to any client-supplied header."""

    return f"req_{uuid.uuid4().hex}"


def build_error(
    *,
    code: str,
    message: str,
    details: dict[str, Any] | None = None,
    retryable: bool = False,
    request_id: str | None = None,
) -> CuralinaError:
    return CuralinaError(
        code=code,
        message=message,
        details=details or {},
        retryable=retryable,
        request_id=request_id or new_request_id(),
    )


def _is_schema_version_error(error: dict[str, Any]) -> bool:
    return "schema_version" in error.get("loc", ())


async def validation_exception_handler(
    request: Request, exc: Exception
) -> JSONResponse:
    """Turn Pydantic/FastAPI validation failures into a structured 422.

    A missing required field or a malformed value never reaches this
    process as a 500: FastAPI raises `RequestValidationError` before the
    route body runs, and this handler is the only place that translates it
    into the shared error contract. An unsupported ``schema_version``
    major is reported with its own `code` so contract tests can
    distinguish it from an ordinary invalid-input rejection.

    Typed as `Exception` rather than `RequestValidationError` to satisfy
    Starlette's `add_exception_handler` signature under mypy strict; this
    handler is only ever registered for `RequestValidationError`.
    """

    assert isinstance(exc, RequestValidationError)
    errors = jsonable_encoder(exc.errors())
    unsupported_version = any(_is_schema_version_error(error) for error in errors)

    if unsupported_version:
        code = UNSUPPORTED_SCHEMA_VERSION_CODE
        message = (
            "Request schema_version is missing or uses an unsupported major version."
        )
    else:
        code = INVALID_REQUEST_CODE
        message = "Request failed validation."

    error = build_error(
        code=code,
        message=message,
        details={"errors": errors},
        retryable=False,
    )
    return JSONResponse(
        status_code=422,
        content=jsonable_encoder(error),
    )
