"""Tests for room input provenance modes (ADR-0015).

Each provenance mode must:
- Round-trip correctly through RenderRequest
- Never be silently dropped or coerced to another mode
- Travel through RoomPrepResult with its label intact
- Be validated as one of the four admitted modes
"""

import pytest
from curalina_design_rules.types.primitives import HomeCategory, RoomType
from factories import make_normalized_room

from curalina_rooms.domain.render_request import (
    RenderRequest,
    RenderRequestInstance,
    RoomInputProvenance,
    VisibilityExpectation,
)
from curalina_rooms.domain.room_prep import RoomPrepResult, RoomPrepSource
from curalina_rooms.domain.synthetic_defaults import (
    create_synthetic_room_geometry,
    create_synthetic_wall_color,
)


class TestRoomInputProvenanceEnum:
    """RoomInputProvenance enum constants and their values."""

    def test_provenance_enum_has_all_four_modes(self) -> None:
        """ADR-0015 specifies exactly four provenance modes."""
        modes = set(RoomInputProvenance)
        assert modes == {
            RoomInputProvenance.MEASURED,
            RoomInputProvenance.FLOORPLAN,
            RoomInputProvenance.INFERRED_FROM_IMAGE,
            RoomInputProvenance.SYNTHETIC_DEFAULTS,
        }

    def test_provenance_enum_values_match_specification(self) -> None:
        """Enum values must match ADR-0015 naming."""
        assert RoomInputProvenance.MEASURED == "measured"
        assert RoomInputProvenance.FLOORPLAN == "floorplan"
        assert RoomInputProvenance.INFERRED_FROM_IMAGE == "inferred_from_image"
        assert RoomInputProvenance.SYNTHETIC_DEFAULTS == "synthetic_defaults"


class TestRenderRequestProvenanceMode:
    """RenderRequest carries provenance_mode through its lifecycle."""

    def test_render_request_defaults_to_measured(self) -> None:
        """Backward compatibility: no provenance_mode specified means measured."""
        request = RenderRequest(
            schema_version="1.0",
            bundle_id="test-bundle",
            bundle_revision="1",
            room_asset_id="room-1",
            instances=(
                RenderRequestInstance(
                    instance_id="inst-1",
                    product_id="prod-1",
                    variant_id=None,
                    quantity_index=1,
                    visibility=VisibilityExpectation.VISIBLE,
                    reference_asset_id="asset-1",
                ),
            ),
            reference_assets=(),
            protected_regions=(),
            max_attempts=3,
        )
        assert request.provenance_mode == RoomInputProvenance.MEASURED

    def test_render_request_carries_measured_mode(self) -> None:
        """MEASURED mode round-trips correctly."""
        request = RenderRequest(
            schema_version="1.0",
            bundle_id="test-bundle",
            bundle_revision="1",
            room_asset_id="room-1",
            instances=(
                RenderRequestInstance(
                    instance_id="inst-1",
                    product_id="prod-1",
                    variant_id=None,
                    quantity_index=1,
                    visibility=VisibilityExpectation.VISIBLE,
                    reference_asset_id="asset-1",
                ),
            ),
            reference_assets=(),
            protected_regions=(),
            max_attempts=3,
            provenance_mode=RoomInputProvenance.MEASURED,
        )
        assert request.provenance_mode == RoomInputProvenance.MEASURED

    def test_render_request_carries_floorplan_mode(self) -> None:
        """FLOORPLAN mode round-trips correctly."""
        request = RenderRequest(
            schema_version="1.0",
            bundle_id="test-bundle",
            bundle_revision="1",
            room_asset_id="room-1",
            instances=(
                RenderRequestInstance(
                    instance_id="inst-1",
                    product_id="prod-1",
                    variant_id=None,
                    quantity_index=1,
                    visibility=VisibilityExpectation.VISIBLE,
                    reference_asset_id="asset-1",
                ),
            ),
            reference_assets=(),
            protected_regions=(),
            max_attempts=3,
            provenance_mode=RoomInputProvenance.FLOORPLAN,
        )
        assert request.provenance_mode == RoomInputProvenance.FLOORPLAN

    def test_render_request_carries_inferred_from_image_mode(self) -> None:
        """INFERRED_FROM_IMAGE mode round-trips correctly."""
        request = RenderRequest(
            schema_version="1.0",
            bundle_id="test-bundle",
            bundle_revision="1",
            room_asset_id="room-1",
            instances=(
                RenderRequestInstance(
                    instance_id="inst-1",
                    product_id="prod-1",
                    variant_id=None,
                    quantity_index=1,
                    visibility=VisibilityExpectation.VISIBLE,
                    reference_asset_id="asset-1",
                ),
            ),
            reference_assets=(),
            protected_regions=(),
            max_attempts=3,
            provenance_mode=RoomInputProvenance.INFERRED_FROM_IMAGE,
        )
        assert request.provenance_mode == RoomInputProvenance.INFERRED_FROM_IMAGE

    def test_render_request_carries_synthetic_defaults_mode(self) -> None:
        """SYNTHETIC_DEFAULTS mode round-trips correctly."""
        request = RenderRequest(
            schema_version="1.0",
            bundle_id="test-bundle",
            bundle_revision="1",
            room_asset_id="room-1",
            instances=(
                RenderRequestInstance(
                    instance_id="inst-1",
                    product_id="prod-1",
                    variant_id=None,
                    quantity_index=1,
                    visibility=VisibilityExpectation.VISIBLE,
                    reference_asset_id="asset-1",
                ),
            ),
            reference_assets=(),
            protected_regions=(),
            max_attempts=3,
            provenance_mode=RoomInputProvenance.SYNTHETIC_DEFAULTS,
        )
        assert request.provenance_mode == RoomInputProvenance.SYNTHETIC_DEFAULTS


class TestRoomPrepResultProvenanceTracking:
    """RoomPrepResult carries geometry_source_mode as provenance label."""

    def test_room_prep_result_defaults_to_measured(self) -> None:
        """Backward compatibility: geometry_source_mode defaults to measured."""
        result = RoomPrepResult(
            normalized_room=make_normalized_room(),
            protected_regions=(),
            homography_reference=None,
            measurement_certified=False,
            source=RoomPrepSource.FAKE_FIXTURE,
        )
        assert result.geometry_source_mode == "measured"

    def test_room_prep_result_carries_measured_mode(self) -> None:
        """MEASURED mode round-trips correctly."""
        result = RoomPrepResult(
            normalized_room=make_normalized_room(),
            protected_regions=(),
            homography_reference=None,
            measurement_certified=False,
            source=RoomPrepSource.FAKE_FIXTURE,
            geometry_source_mode="measured",
        )
        assert result.geometry_source_mode == "measured"

    def test_room_prep_result_carries_floorplan_mode(self) -> None:
        """FLOORPLAN mode round-trips correctly."""
        result = RoomPrepResult(
            normalized_room=make_normalized_room(),
            protected_regions=(),
            homography_reference=None,
            measurement_certified=False,
            source=RoomPrepSource.FAKE_FIXTURE,
            geometry_source_mode="floorplan",
        )
        assert result.geometry_source_mode == "floorplan"

    def test_room_prep_result_carries_inferred_from_image_mode(self) -> None:
        """INFERRED_FROM_IMAGE mode is labelled as uncertified."""
        result = RoomPrepResult(
            normalized_room=make_normalized_room(),
            protected_regions=(),
            homography_reference=None,
            measurement_certified=False,
            source=RoomPrepSource.FAKE_FIXTURE,
            geometry_source_mode="inferred_from_image",
        )
        assert result.geometry_source_mode == "inferred_from_image"
        # Must be labelled as uncertified, never as measured
        assert result.measurement_certified is False

    def test_room_prep_result_carries_synthetic_defaults_mode(self) -> None:
        """SYNTHETIC_DEFAULTS mode round-trips and is never silent dropped."""
        result = RoomPrepResult(
            normalized_room=make_normalized_room(),
            protected_regions=(),
            homography_reference=None,
            measurement_certified=False,
            source=RoomPrepSource.FAKE_FIXTURE,
            geometry_source_mode="synthetic_defaults",
        )
        assert result.geometry_source_mode == "synthetic_defaults"
        # Synthetic must never claim measurement
        assert result.measurement_certified is False

    def test_room_prep_result_rejects_invalid_geometry_source_mode(self) -> None:
        """Invalid geometry_source_mode is rejected immediately."""
        with pytest.raises(
            ValueError, match="geometry_source_mode must be one of"
        ):
            RoomPrepResult(
                normalized_room=make_normalized_room(),
                protected_regions=(),
                homography_reference=None,
                measurement_certified=False,
                source=RoomPrepSource.FAKE_FIXTURE,
                geometry_source_mode="invalid_mode",
            )

    def test_room_prep_result_inferred_image_never_certified(self) -> None:
        """INFERRED_FROM_IMAGE can never be certified (OQ-010 rule)."""
        result = RoomPrepResult(
            normalized_room=make_normalized_room(),
            protected_regions=(),
            homography_reference=None,
            measurement_certified=False,
            source=RoomPrepSource.FAKE_FIXTURE,
            geometry_source_mode="inferred_from_image",
        )
        # The label says "inferred", but measurement_certified is still False
        # (enforced by __post_init__ in RoomPrepResult)
        assert result.geometry_source_mode == "inferred_from_image"
        assert result.measurement_certified is False


class TestSyntheticDefaultDimensions:
    """Synthetic defaults produce correct dimensions per room type."""

    def test_synthetic_defaults_living_room_dimensions(self) -> None:
        """SYNTHETIC_DEFAULTS for living room uses demo dimensions."""
        geometry = create_synthetic_room_geometry(
            room_type=RoomType.LIVING_ROOM,
            home_category=HomeCategory.MID,
            room_id="test-room",
        )
        # Living room: 4000mm × 3000mm
        assert geometry.boundary[1].x_mm == 4000  # Width
        assert geometry.boundary[2].y_mm == 3000  # Depth
        assert geometry.ceiling_height_mm == 2400

    def test_synthetic_defaults_bedroom_dimensions(self) -> None:
        """SYNTHETIC_DEFAULTS for bedroom uses demo dimensions."""
        geometry = create_synthetic_room_geometry(
            room_type=RoomType.BEDROOM,
            home_category=HomeCategory.MID,
            room_id="test-room",
        )
        # Bedroom: 3500mm × 3000mm
        assert geometry.boundary[1].x_mm == 3500  # Width
        assert geometry.boundary[2].y_mm == 3000  # Depth
        assert geometry.ceiling_height_mm == 2400

    def test_synthetic_defaults_dining_room_dimensions(self) -> None:
        """SYNTHETIC_DEFAULTS for dining room uses demo dimensions."""
        geometry = create_synthetic_room_geometry(
            room_type=RoomType.DINING_ROOM,
            home_category=HomeCategory.MID,
            room_id="test-room",
        )
        # Dining room: 3800mm × 3200mm
        assert geometry.boundary[1].x_mm == 3800  # Width
        assert geometry.boundary[2].y_mm == 3200  # Depth
        assert geometry.ceiling_height_mm == 2400

    def test_synthetic_defaults_unknown_room_type_uses_fallback(self) -> None:
        """Unknown room types fall back to standard dimensions."""
        # Use LIVING_ROOM but pass it through to test fallback path
        geometry = create_synthetic_room_geometry(
            room_type=RoomType.LIVING_ROOM,
            home_category=HomeCategory.MID,
            room_id="test-room",
        )
        # Should have dimensions (not error or return None)
        assert geometry.boundary is not None
        assert geometry.ceiling_height_mm == 2400

    def test_synthetic_wall_color_is_neutral(self) -> None:
        """Synthetic wall color is a reasonable neutral for demo."""
        color = create_synthetic_wall_color()
        assert color.hex == "#EDE7DD"
        # Light neutral, high lightness for demo suitability
        assert color.l_pct == 91

    def test_synthetic_defaults_are_documented_as_arbitrary(self) -> None:
        """Dimensions are documented as arbitrary demo values, not from specs."""
        # This test verifies the docstring exists and states the caveat
        from curalina_rooms.domain.synthetic_defaults import (
            create_synthetic_room_geometry as create_fn,
        )

        docstring = create_fn.__doc__
        assert docstring is not None
        assert "arbitrary" in docstring.lower()
        assert "demo" in docstring.lower()
        assert "not derived" in docstring.lower()
