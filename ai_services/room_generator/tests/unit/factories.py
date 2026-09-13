"""Shared test builders for A2 domain/application unit tests.

Keeps individual test modules focused on the one invariant they're
checking rather than repeating `StyledRoom`/`RenderRequest` construction
boilerplate.
"""

from __future__ import annotations

from curalina_design_rules.pipeline.types import (
    NormalizedRoom,
    StyledRoom,
    ValidatedLayout,
)
from curalina_design_rules.types.catalog import (
    Product,
    ProductAttributes,
    ProductInstance,
)
from curalina_design_rules.types.geometry import Placement, Point, RoomGeometry
from curalina_design_rules.types.palette import (
    LightingPlan,
    MaterialAssignment,
    Palette,
)
from curalina_design_rules.types.primitives import (
    Color,
    HomeCategory,
    ProductCategory,
    RoomType,
)
from curalina_design_rules.types.results import RuleResult

from curalina_rooms.application.validate_render_request import (
    ValidatedRenderRequest,
    validate_render_request,
)
from curalina_rooms.domain.geometry import BoundingBox
from curalina_rooms.domain.render_request import (
    ReferenceAssetInfo,
    RenderRequest,
    RenderRequestInstance,
    VariantReviewStatus,
    VisibilityExpectation,
)
from curalina_rooms.domain.room_prep import (
    ProtectedRegion,
    ProtectedRegionKind,
    RoomPrepResult,
    RoomPrepSource,
)

DEFAULT_BUNDLE_REVISION = "rev_0001"


def validate(request: RenderRequest) -> ValidatedRenderRequest:
    """Shorthand for `validate_render_request` against the fixed fixture
    bundle revision every `make_render_request()` call defaults to."""

    return validate_render_request(
        request, current_bundle_revision=DEFAULT_BUNDLE_REVISION
    )


def make_bounding_box(
    x0: float = 0.1, y0: float = 0.1, x1: float = 0.2, y1: float = 0.2
) -> BoundingBox:
    return BoundingBox(x0=x0, y0=y0, x1=x1, y1=y1)


def make_reference_asset(
    *,
    asset_id: str = "asset_ref_0001",
    product_id: str = "prod_chair_001",
    variant_id: str | None = None,
    variant_parent_product_id: str | None = None,
    variant_review_status: VariantReviewStatus | None = None,
    image_space_box: BoundingBox | None = None,
) -> ReferenceAssetInfo:
    return ReferenceAssetInfo(
        asset_id=asset_id,
        product_id=product_id,
        variant_id=variant_id,
        variant_parent_product_id=variant_parent_product_id,
        variant_review_status=variant_review_status,
        image_space_box=image_space_box or make_bounding_box(),
    )


def make_instance(
    *,
    instance_id: str = "inst_0001",
    product_id: str = "prod_chair_001",
    variant_id: str | None = None,
    quantity_index: int = 1,
    visibility: VisibilityExpectation = VisibilityExpectation.VISIBLE,
    reference_asset_id: str = "asset_ref_0001",
) -> RenderRequestInstance:
    return RenderRequestInstance(
        instance_id=instance_id,
        product_id=product_id,
        variant_id=variant_id,
        quantity_index=quantity_index,
        visibility=visibility,
        reference_asset_id=reference_asset_id,
    )


def make_protected_region(
    *,
    region_id: str = "region_door_0001",
    kind: ProtectedRegionKind = ProtectedRegionKind.DOOR,
    image_space_box: BoundingBox | None = None,
) -> ProtectedRegion:
    return ProtectedRegion(
        region_id=region_id,
        kind=kind,
        image_space_box=image_space_box
        or make_bounding_box(x0=0.7, y0=0.7, x1=0.9, y1=0.9),
    )


def make_render_request(
    *,
    schema_version: str = "1.0",
    bundle_id: str = "bundle_liv001",
    bundle_revision: str = DEFAULT_BUNDLE_REVISION,
    room_asset_id: str = "asset_room_0001",
    instances: tuple[RenderRequestInstance, ...] | None = None,
    reference_assets: tuple[ReferenceAssetInfo, ...] | None = None,
    protected_regions: tuple[ProtectedRegion, ...] = (),
    max_attempts: int = 3,
) -> RenderRequest:
    return RenderRequest(
        schema_version=schema_version,
        bundle_id=bundle_id,
        bundle_revision=bundle_revision,
        room_asset_id=room_asset_id,
        instances=instances if instances is not None else (make_instance(),),
        reference_assets=(
            reference_assets
            if reference_assets is not None
            else (make_reference_asset(),)
        ),
        protected_regions=protected_regions,
        max_attempts=max_attempts,
    )


def make_normalized_room() -> NormalizedRoom:
    geometry = RoomGeometry(
        room_id="room_fixture_0001",
        room_type=RoomType.LIVING_ROOM,
        home_category=HomeCategory.MID,
        boundary=(
            Point(x_mm=0, y_mm=0),
            Point(x_mm=4000, y_mm=0),
            Point(x_mm=4000, y_mm=3000),
            Point(x_mm=0, y_mm=3000),
        ),
        ceiling_height_mm=2400,
    )
    return NormalizedRoom(
        geometry=geometry,
        recommended_wall_color=Color(hex="#EDE7DD", h_deg=38, s_pct=24, l_pct=91),
        existing_wall_color=None,
    )


def make_room_prep_result(
    *, protected_regions: tuple[ProtectedRegion, ...] = ()
) -> RoomPrepResult:
    return RoomPrepResult(
        normalized_room=make_normalized_room(),
        protected_regions=protected_regions,
        homography_reference=None,
        measurement_certified=False,
        source=RoomPrepSource.FAKE_FIXTURE,
    )


def make_styled_room() -> StyledRoom:
    product = Product(
        product_id="prod_chair_001",
        name="Fixture chair",
        category=ProductCategory.CHAIR,
        width_mm=500,
        depth_mm=500,
        height_mm=800,
        price=None,
        attributes=ProductAttributes(),
    )
    instance = ProductInstance(
        instance_id="inst_0001", product=product, quantity_index=1
    )
    placement = Placement(instance=instance, x_mm=1000, y_mm=1000, rotation_deg=0)
    layout = ValidatedLayout(
        placements=(placement,),
        normalized_room=make_normalized_room(),
        spatial_result=RuleResult(violations=(), rules_version="fixture-1.0"),
    )
    return StyledRoom(
        layout=layout,
        palette=Palette(
            foundation=Color(hex="#EDE7DD", h_deg=38, s_pct=24, l_pct=91),
            accent=Color(hex="#7A5C3E", h_deg=28, s_pct=32, l_pct=35),
            metal="brass",
            high_luster=False,
            seed=1,
        ),
        material_assignment=MaterialAssignment(assignments=()),
        lighting_plan=LightingPlan(notes=("fixture lighting plan",)),
    )
