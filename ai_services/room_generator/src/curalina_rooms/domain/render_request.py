"""Validated-input types for a render request.

These are the domain-layer counterparts of the API-layer DTOs in
`curalina_rooms.api.schemas` (`RenderJobRequest` etc.) — the API layer
handles wire shape and structural validation; these types carry the same
facts through application use cases as immutable, already-checked domain
records, and add the fields the API's A1 fixtures did not need to model
(each reference asset's variant lineage and review status).
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum

from curalina_rooms.domain.geometry import BoundingBox
from curalina_rooms.domain.room_prep import ProtectedRegion


class VisibilityExpectation(StrEnum):
    """What the render is expected to show for one instance.

    A hero product required to be `VISIBLE` cannot be excused as `ABSENT`
    after generation (`architecture/guides/06_room_generation.md`).
    """

    VISIBLE = "visible"
    OCCLUDED = "occluded"
    OUT_OF_FRAME = "out_of_frame"


class VariantReviewStatus(StrEnum):
    """Mirrors the variant service's `review_status`
    (`architecture/guides/03_data_contracts.md`)."""

    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


@dataclass(frozen=True)
class ReferenceAssetInfo:
    """A catalogue/variant reference image already imported via
    `POST /v1/assets`, carrying enough upstream lineage for this service to
    validate it without reading the variant service's own database."""

    asset_id: str
    product_id: str
    variant_id: str | None
    variant_parent_product_id: str | None
    variant_review_status: VariantReviewStatus | None
    image_space_box: BoundingBox

    def __post_init__(self) -> None:
        if not self.asset_id.strip():
            raise ValueError("asset_id is required")
        if not self.product_id.strip():
            raise ValueError("product_id is required")


@dataclass(frozen=True)
class RenderRequestInstance:
    """One expected product instance in the render (an `ExpectedObject` per
    `architecture/guides/06_room_generation.md`'s domain module list).

    `quantity_index` distinguishes intentional duplicates of the same
    product (e.g. two dining chairs) — each duplicate is its own instance
    with a unique `instance_id`.
    """

    instance_id: str
    product_id: str
    variant_id: str | None
    quantity_index: int
    visibility: VisibilityExpectation
    reference_asset_id: str

    def __post_init__(self) -> None:
        if not self.instance_id.strip():
            raise ValueError("instance_id is required")
        if not self.product_id.strip():
            raise ValueError("product_id is required")
        if self.quantity_index < 1:
            raise ValueError("quantity_index must be >= 1")


@dataclass(frozen=True)
class RenderRequest:
    """Fully-typed, already-structurally-valid render request, ready for
    `curalina_rooms.application.validate_render_request`."""

    schema_version: str
    bundle_id: str
    bundle_revision: str
    room_asset_id: str
    instances: tuple[RenderRequestInstance, ...]
    reference_assets: tuple[ReferenceAssetInfo, ...]
    protected_regions: tuple[ProtectedRegion, ...]
    max_attempts: int

    def __post_init__(self) -> None:
        if not self.instances:
            raise ValueError("a render request requires at least one instance")
        if self.max_attempts < 1:
            raise ValueError("max_attempts must be >= 1")
