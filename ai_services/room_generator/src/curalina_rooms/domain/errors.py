"""Domain-level error vocabulary for render-request validation and
rendering orchestration.

These are distinct from `curalina_rooms.api.errors.ContractError` (which is
the A1 transport-facing error shape). Domain errors are raised by
`application/` use cases operating on already-structurally-valid
`RenderRequest` domain objects; a future A3 API layer maps each of these to
the shared `code, message, details, retryable, request_id` error shape at
the transport boundary, the same way it will map contract errors today.
"""

from __future__ import annotations


class RenderPlanValidationError(Exception):
    """Base class for every render-request/render-plan validation failure."""


class UnsupportedSchemaVersionError(RenderPlanValidationError):
    def __init__(self, provided_version: str, supported_major: str) -> None:
        self.provided_version = provided_version
        self.supported_major = supported_major
        super().__init__(
            f"schema_version {provided_version!r} is not supported major "
            f"version {supported_major!r}"
        )


class StaleBundleRevisionError(RenderPlanValidationError):
    def __init__(
        self, bundle_id: str, requested_revision: str, current_revision: str
    ) -> None:
        self.bundle_id = bundle_id
        self.requested_revision = requested_revision
        self.current_revision = current_revision
        super().__init__(
            f"bundle {bundle_id!r} revision {requested_revision!r} is stale; "
            f"current revision is {current_revision!r}"
        )


class MissingReferenceAssetError(RenderPlanValidationError):
    def __init__(self, instance_id: str, reference_asset_id: str) -> None:
        self.instance_id = instance_id
        self.reference_asset_id = reference_asset_id
        super().__init__(
            f"instance {instance_id!r} references asset "
            f"{reference_asset_id!r}, which was not imported via "
            "POST /v1/assets"
        )


class MismatchedVariantParentError(RenderPlanValidationError):
    def __init__(
        self, instance_id: str, expected_product_id: str, actual_parent_product_id: str
    ) -> None:
        self.instance_id = instance_id
        self.expected_product_id = expected_product_id
        self.actual_parent_product_id = actual_parent_product_id
        super().__init__(
            f"instance {instance_id!r} expects product "
            f"{expected_product_id!r} but its reference asset's variant "
            f"parent is {actual_parent_product_id!r}"
        )


class RejectedVariantImportError(RenderPlanValidationError):
    def __init__(self, instance_id: str, variant_id: str) -> None:
        self.instance_id = instance_id
        self.variant_id = variant_id
        super().__init__(
            f"instance {instance_id!r} references variant {variant_id!r}, "
            "which has review_status 'rejected'"
        )


class DuplicateInstanceIdError(RenderPlanValidationError):
    def __init__(self, instance_id: str) -> None:
        self.instance_id = instance_id
        super().__init__(f"instance_id {instance_id!r} appears more than once")


class ProtectedOpeningOverlapError(RenderPlanValidationError):
    def __init__(self, instance_id: str, region_id: str) -> None:
        self.instance_id = instance_id
        self.region_id = region_id
        super().__init__(
            f"instance {instance_id!r} placement overlaps protected region "
            f"{region_id!r} (door/window/retained object)"
        )


class MaxAttemptsExceededError(RenderPlanValidationError):
    def __init__(
        self, render_job_id: str, attempt_count: int, max_attempts: int
    ) -> None:
        self.render_job_id = render_job_id
        self.attempt_count = attempt_count
        self.max_attempts = max_attempts
        super().__init__(
            f"render job {render_job_id!r} exceeded max_attempts "
            f"({attempt_count} > {max_attempts})"
        )
