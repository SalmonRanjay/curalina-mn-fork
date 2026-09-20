"""Canonical error vocabulary for the room-generator `/v1` surface.

Every failure path raises `ContractError`, which carries the exact
`code, message, details, retryable, request_id` fields required by
`architecture/guides/03_data_contracts.md` and validated against
`ai_services/contracts/v1/schemas/error.schema.json`. Handlers in
`curalina_rooms.api.service` never return a bare 500 for a structurally or
semantically invalid request — they raise one of the factories below.
"""

from __future__ import annotations

from typing import Any

from curalina_rooms.api.schemas import ErrorResponse


class ContractError(Exception):
    """Raised by the contract service; carries the HTTP status to use."""

    def __init__(
        self,
        *,
        http_status: int,
        code: str,
        message: str,
        details: dict[str, Any],
        retryable: bool,
        request_id: str,
    ) -> None:
        super().__init__(message)
        self.http_status = http_status
        self.error = ErrorResponse(
            code=code,
            message=message,
            details=details,
            retryable=retryable,
            request_id=request_id,
        )


def unsupported_schema_version_error(
    request_id: str, provided_version: str
) -> ContractError:
    return ContractError(
        http_status=422,
        code="unsupported_schema_version",
        message=(
            f"schema_version '{provided_version}' is not a supported major "
            "version; this service accepts major version 1."
        ),
        details={"provided_version": provided_version, "supported_major": "1"},
        retryable=False,
        request_id=request_id,
    )


def malformed_request_error(
    request_id: str, validation_errors: list[dict[str, Any]]
) -> ContractError:
    return ContractError(
        http_status=400,
        code="malformed_request",
        message="Request payload failed structural validation.",
        details={"validation_errors": validation_errors},
        retryable=False,
        request_id=request_id,
    )


def stale_bundle_revision_error(
    request_id: str, bundle_id: str, requested_revision: str, current_revision: str
) -> ContractError:
    return ContractError(
        http_status=409,
        code="stale_bundle_revision",
        message=(
            f"bundle '{bundle_id}' revision '{requested_revision}' is stale; "
            f"the current revision is '{current_revision}'."
        ),
        details={
            "bundle_id": bundle_id,
            "requested_revision": requested_revision,
            "current_revision": current_revision,
        },
        retryable=False,
        request_id=request_id,
    )


def unknown_bundle_error(request_id: str, bundle_id: str) -> ContractError:
    return ContractError(
        http_status=404,
        code="unknown_bundle",
        message=f"bundle '{bundle_id}' is not known to this service.",
        details={"bundle_id": bundle_id},
        retryable=False,
        request_id=request_id,
    )


def missing_reference_image_error(request_id: str, asset_id: str) -> ContractError:
    return ContractError(
        http_status=422,
        code="missing_reference_image",
        message=(
            f"reference image asset '{asset_id}' has not been imported via "
            "POST /v1/assets; refusing to guess a substitute."
        ),
        details={"asset_id": asset_id},
        retryable=False,
        request_id=request_id,
    )


def resource_not_found_error(
    request_id: str, resource_type: str, resource_id: str
) -> ContractError:
    return ContractError(
        http_status=404,
        code="resource_not_found",
        message=f"{resource_type} '{resource_id}' was not found.",
        details={"resource_type": resource_type, "resource_id": resource_id},
        retryable=False,
        request_id=request_id,
    )


def invalid_job_state_error(
    request_id: str, job_id: str, current_status: str, action: str
) -> ContractError:
    return ContractError(
        http_status=409,
        code="invalid_job_state",
        message=(
            f"job '{job_id}' cannot be {action}d while in status "
            f"'{current_status}'."
        ),
        details={
            "job_id": job_id,
            "current_status": current_status,
            "action": action,
        },
        retryable=False,
        request_id=request_id,
    )


def review_version_conflict_error(
    request_id: str, candidate_id: str, expected_version: int, current_version: int
) -> ContractError:
    return ContractError(
        http_status=409,
        code="review_version_conflict",
        message=(
            f"candidate '{candidate_id}' review version {expected_version} is "
            f"stale; current version is {current_version}."
        ),
        details={
            "candidate_id": candidate_id,
            "expected_version": expected_version,
            "current_version": current_version,
        },
        retryable=False,
        request_id=request_id,
    )
