"""`ValidateRenderRequest` — the first step of `06_room_generation.md`'s
build order: "render request validation, imported asset references and
immutable input snapshots."

Pure domain validation: no I/O, no adapters. Bundle-revision currency is
passed in by the caller (which, in A3, obtains it from the same fixture/
store the A1 contract layer uses) rather than fetched here, keeping this
function testable without any storage dependency.
"""

from __future__ import annotations

from dataclasses import dataclass

from curalina_rooms.domain.errors import (
    DuplicateInstanceIdError,
    MismatchedVariantParentError,
    MissingReferenceAssetError,
    ProtectedOpeningOverlapError,
    RejectedVariantImportError,
    StaleBundleRevisionError,
    UnsupportedSchemaVersionError,
)
from curalina_rooms.domain.render_request import (
    ReferenceAssetInfo,
    RenderRequest,
    VariantReviewStatus,
)

SUPPORTED_SCHEMA_MAJOR = "1"


@dataclass(frozen=True)
class ValidatedRenderRequest:
    """A `RenderRequest` that has passed every structural and cross-
    reference check below. Application code downstream of this point may
    assume every instance's `reference_asset_id` resolves and is usable."""

    request: RenderRequest
    reference_assets_by_id: dict[str, ReferenceAssetInfo]


def validate_render_request(
    request: RenderRequest, *, current_bundle_revision: str
) -> ValidatedRenderRequest:
    major = request.schema_version.split(".", 1)[0]
    if major != SUPPORTED_SCHEMA_MAJOR:
        raise UnsupportedSchemaVersionError(
            request.schema_version, SUPPORTED_SCHEMA_MAJOR
        )

    if request.bundle_revision != current_bundle_revision:
        raise StaleBundleRevisionError(
            request.bundle_id, request.bundle_revision, current_bundle_revision
        )

    reference_assets_by_id = {
        asset.asset_id: asset for asset in request.reference_assets
    }

    seen_instance_ids: set[str] = set()
    for instance in request.instances:
        if instance.instance_id in seen_instance_ids:
            raise DuplicateInstanceIdError(instance.instance_id)
        seen_instance_ids.add(instance.instance_id)

        reference = reference_assets_by_id.get(instance.reference_asset_id)
        if reference is None:
            raise MissingReferenceAssetError(
                instance.instance_id, instance.reference_asset_id
            )

        if (
            reference.variant_parent_product_id is not None
            and reference.variant_parent_product_id != instance.product_id
        ):
            raise MismatchedVariantParentError(
                instance.instance_id,
                instance.product_id,
                reference.variant_parent_product_id,
            )

        if reference.variant_review_status is VariantReviewStatus.REJECTED:
            variant_id = reference.variant_id or reference.asset_id
            raise RejectedVariantImportError(instance.instance_id, variant_id)

        for region in request.protected_regions:
            if reference.image_space_box.overlaps(region.image_space_box):
                raise ProtectedOpeningOverlapError(
                    instance.instance_id, region.region_id
                )

    return ValidatedRenderRequest(
        request=request, reference_assets_by_id=reference_assets_by_id
    )
