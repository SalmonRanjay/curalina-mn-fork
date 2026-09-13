"""Shared error vocabulary for the variant-generator HTTP contract.

Shape is fixed by `architecture/guides/03_data_contracts.md` and mirrored in
`ai_services/contracts/v1/schemas/error.schema.json`: every error body carries
exactly `code`, `message`, `details`, `retryable` and `request_id`. This is the
same shape the recommendation and room-generation services must reproduce, so
`contracts-qa-steward` can diff them byte-for-byte.
"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class ErrorBody(BaseModel):
    """The wire shape of a Curalina error response."""

    model_config = ConfigDict(frozen=True, extra="forbid")

    code: str = Field(min_length=1)
    message: str = Field(min_length=1)
    details: dict[str, Any] = Field(default_factory=dict)
    retryable: bool
    request_id: str = Field(min_length=1)


class ApiError(Exception):
    """Raised by handlers; carries the HTTP status alongside the error body."""

    def __init__(self, status_code: int, body: ErrorBody) -> None:
        super().__init__(body.message)
        self.status_code = status_code
        self.body = body


# Canonical error codes used across this service's contract. Codes are
# semantic strings per `03_data_contracts.md`, not numeric.
CODE_UNSUPPORTED_VERSION = "unsupported_schema_version"
CODE_VALIDATION_ERROR = "validation_error"
CODE_NOT_FOUND = "not_found"
CODE_CONFLICT = "idempotency_conflict"
CODE_REVISION_CONFLICT = "revision_conflict"
CODE_PAYLOAD_TOO_LARGE = "payload_too_large"
CODE_INVALID_STATE_TRANSITION = "invalid_state_transition"


def unsupported_version_error(request_id: str, *, received: str) -> ApiError:
    return ApiError(
        422,
        ErrorBody(
            code=CODE_UNSUPPORTED_VERSION,
            message=f"Unsupported schema_version: {received!r}",
            details={"received": received, "supported_major": 1},
            retryable=False,
            request_id=request_id,
        ),
    )


def validation_error(
    request_id: str, *, message: str, details: dict[str, Any] | None = None
) -> ApiError:
    return ApiError(
        422,
        ErrorBody(
            code=CODE_VALIDATION_ERROR,
            message=message,
            details=details or {},
            retryable=False,
            request_id=request_id,
        ),
    )


def not_found_error(request_id: str, *, resource: str, resource_id: str) -> ApiError:
    return ApiError(
        404,
        ErrorBody(
            code=CODE_NOT_FOUND,
            message=f"Unknown {resource}: {resource_id!r}",
            details={"resource": resource, "resource_id": resource_id},
            retryable=False,
            request_id=request_id,
        ),
    )


def idempotency_conflict_error(request_id: str, *, idempotency_key: str) -> ApiError:
    return ApiError(
        409,
        ErrorBody(
            code=CODE_CONFLICT,
            message="Idempotency key reused with a different request payload",
            details={"idempotency_key": idempotency_key},
            retryable=False,
            request_id=request_id,
        ),
    )


def revision_conflict_error(
    request_id: str, *, expected_revision: int, actual_revision: int
) -> ApiError:
    return ApiError(
        409,
        ErrorBody(
            code=CODE_REVISION_CONFLICT,
            message="Review submitted against a stale candidate revision",
            details={
                "expected_revision": expected_revision,
                "actual_revision": actual_revision,
            },
            retryable=False,
            request_id=request_id,
        ),
    )


def payload_too_large_error(
    request_id: str, *, max_bytes: int, received_bytes: int
) -> ApiError:
    return ApiError(
        413,
        ErrorBody(
            code=CODE_PAYLOAD_TOO_LARGE,
            message="Uploaded asset exceeds the maximum accepted size",
            details={"max_bytes": max_bytes, "received_bytes": received_bytes},
            retryable=False,
            request_id=request_id,
        ),
    )


def invalid_state_transition_error(
    request_id: str, *, current_status: str, action: str
) -> ApiError:
    return ApiError(
        409,
        ErrorBody(
            code=CODE_INVALID_STATE_TRANSITION,
            message=f"Cannot {action} a job in status {current_status!r}",
            details={"current_status": current_status, "action": action},
            retryable=False,
            request_id=request_id,
        ),
    )
