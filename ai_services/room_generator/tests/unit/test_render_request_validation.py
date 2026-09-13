"""Mandatory A2 unit tests from `agentic_flow/room_generator_workflow.md`:
missing reference, mismatched variant parent, unsupported schema, invalid
mask coordinates, protected-opening overlap, intentional quantity two,
duplicate instance IDs, rejected-variant import, stale bundle revision,
immutable input snapshots.

("Invalid mask coordinates" is covered in `test_geometry.py` — `BoundingBox`
makes that state unrepresentable at construction, which is a stronger
guarantee than a downstream check. "Maximum attempts exceeded" is covered
in `test_generate_room_use_case.py`, since it's a generation-orchestration
concern, not a request-validation one.)
"""

from __future__ import annotations

import dataclasses

import pytest
from factories import (
    make_bounding_box,
    make_instance,
    make_protected_region,
    make_reference_asset,
    make_render_request,
    validate,
)

from curalina_rooms.application.validate_render_request import validate_render_request
from curalina_rooms.domain.errors import (
    DuplicateInstanceIdError,
    MismatchedVariantParentError,
    MissingReferenceAssetError,
    ProtectedOpeningOverlapError,
    RejectedVariantImportError,
    StaleBundleRevisionError,
    UnsupportedSchemaVersionError,
)
from curalina_rooms.domain.render_request import VariantReviewStatus


def test_missing_reference_asset_is_rejected() -> None:
    request = make_render_request(
        instances=(make_instance(reference_asset_id="asset_does_not_exist"),),
        reference_assets=(make_reference_asset(asset_id="asset_ref_0001"),),
    )

    with pytest.raises(MissingReferenceAssetError):
        validate(request)


def test_mismatched_variant_parent_is_rejected() -> None:
    request = make_render_request(
        instances=(make_instance(product_id="prod_chair_001"),),
        reference_assets=(
            make_reference_asset(
                variant_id="var_0001",
                variant_parent_product_id="prod_sofa_999",
            ),
        ),
    )

    with pytest.raises(MismatchedVariantParentError):
        validate(request)


def test_unsupported_schema_version_is_rejected() -> None:
    request = make_render_request(schema_version="2.0")

    with pytest.raises(UnsupportedSchemaVersionError):
        validate(request)


def test_protected_opening_overlap_is_rejected() -> None:
    overlapping_box = make_bounding_box(x0=0.1, y0=0.1, x1=0.3, y1=0.3)
    conflicting_region_box = make_bounding_box(x0=0.2, y0=0.2, x1=0.4, y1=0.4)
    request = make_render_request(
        instances=(make_instance(),),
        reference_assets=(make_reference_asset(image_space_box=overlapping_box),),
        protected_regions=(make_protected_region(image_space_box=conflicting_region_box),),
    )

    with pytest.raises(ProtectedOpeningOverlapError):
        validate(request)


def test_non_overlapping_protected_region_is_accepted() -> None:
    instance_box = make_bounding_box(x0=0.0, y0=0.0, x1=0.1, y1=0.1)
    region_box = make_bounding_box(x0=0.8, y0=0.8, x1=0.9, y1=0.9)
    request = make_render_request(
        instances=(make_instance(),),
        reference_assets=(make_reference_asset(image_space_box=instance_box),),
        protected_regions=(make_protected_region(image_space_box=region_box),),
    )

    validated = validate(request)

    assert validated.request is request


def test_intentional_quantity_two_is_accepted() -> None:
    """Two chairs of the same product, each its own instance, is intentional
    repetition — not a duplicate to reject
    (`architecture/guides/06_room_generation.md`)."""

    request = make_render_request(
        instances=(
            make_instance(
                instance_id="inst_chair_0001",
                quantity_index=1,
                reference_asset_id="asset_ref_0001",
            ),
            make_instance(
                instance_id="inst_chair_0002",
                quantity_index=2,
                reference_asset_id="asset_ref_0001",
            ),
        ),
        reference_assets=(make_reference_asset(asset_id="asset_ref_0001"),),
    )

    validated = validate(request)

    assert {i.instance_id for i in validated.request.instances} == {
        "inst_chair_0001",
        "inst_chair_0002",
    }


def test_duplicate_instance_ids_are_rejected() -> None:
    request = make_render_request(
        instances=(
            make_instance(instance_id="inst_dup"),
            make_instance(instance_id="inst_dup"),
        ),
        reference_assets=(make_reference_asset(),),
    )

    with pytest.raises(DuplicateInstanceIdError):
        validate(request)


def test_rejected_variant_import_is_rejected() -> None:
    request = make_render_request(
        reference_assets=(
            make_reference_asset(
                variant_id="var_0001",
                variant_review_status=VariantReviewStatus.REJECTED,
            ),
        ),
    )

    with pytest.raises(RejectedVariantImportError):
        validate(request)


def test_stale_bundle_revision_is_rejected() -> None:
    request = make_render_request(bundle_revision="rev_0001")

    with pytest.raises(StaleBundleRevisionError):
        validate_render_request(request, current_bundle_revision="rev_0002")


def test_render_request_is_an_immutable_input_snapshot() -> None:
    request = make_render_request()

    with pytest.raises(dataclasses.FrozenInstanceError):
        request.bundle_revision = "rev_9999"  # type: ignore[misc]

    mutable_instances = list(request.instances)
    mutable_instances.append(make_instance(instance_id="inst_added_after"))
    # Mutating a list built from the tuple must not affect the original.
    assert len(request.instances) == 1
