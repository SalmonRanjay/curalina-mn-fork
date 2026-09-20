"""Tests for FakeRoomPrepAdapter with provenance modes (ADR-0015).

The adapter must:
- Support all four provenance modes
- Produce fixture geometry for measured/floorplan/inferred modes
- Produce synthetic default geometry for synthetic_defaults mode
- Label output with the correct geometry_source_mode
- Never claim measurement certification for inferred or synthetic modes
"""


from curalina_rooms.adapters.fake_room_prep import FakeRoomPrepAdapter
from curalina_rooms.domain.room_prep import (
    ProtectedRegionKind,
    RoomPrepRequest,
    RoomPrepSource,
)


class TestFakeRoomPrepAdapterProvenanceModes:
    """FakeRoomPrepAdapter correctly handles provenance modes."""

    def setup_method(self) -> None:
        self.adapter = FakeRoomPrepAdapter()
        self.request = RoomPrepRequest(
            room_asset_id="test-room",
            requested_protected_region_kinds=(ProtectedRegionKind.DOOR,),
        )

    def test_adapter_defaults_to_measured_geometry(self) -> None:
        """Without explicit geometry_source_mode, adapter uses measured."""
        result = self.adapter.prepare(self.request)
        assert result.geometry_source_mode == "measured"
        assert result.measurement_certified is False
        assert result.source == RoomPrepSource.FAKE_FIXTURE

    def test_adapter_produces_measured_mode_geometry(self) -> None:
        """MEASURED mode produces fixture geometry."""
        result = self.adapter.prepare(
            self.request, geometry_source_mode="measured"
        )
        assert result.geometry_source_mode == "measured"
        # Fixture geometry: 4000 × 3000 mm
        geometry = result.normalized_room.geometry
        assert geometry.boundary[1].x_mm == 4000
        assert geometry.boundary[2].y_mm == 3000

    def test_adapter_produces_floorplan_mode_geometry(self) -> None:
        """FLOORPLAN mode produces fixture geometry."""
        result = self.adapter.prepare(
            self.request, geometry_source_mode="floorplan"
        )
        assert result.geometry_source_mode == "floorplan"
        # Fixture geometry: 4000 × 3000 mm
        geometry = result.normalized_room.geometry
        assert geometry.boundary[1].x_mm == 4000
        assert geometry.boundary[2].y_mm == 3000

    def test_adapter_produces_inferred_from_image_mode_geometry(self) -> None:
        """INFERRED_FROM_IMAGE mode labels output but still uses fixture geometry."""
        result = self.adapter.prepare(
            self.request, geometry_source_mode="inferred_from_image"
        )
        assert result.geometry_source_mode == "inferred_from_image"
        # Output must be labelled as inferred, never certified
        assert result.measurement_certified is False
        # Geometry is still the fixture geometry
        geometry = result.normalized_room.geometry
        assert geometry.boundary[1].x_mm == 4000
        assert geometry.boundary[2].y_mm == 3000

    def test_adapter_produces_synthetic_defaults_mode_geometry(self) -> None:
        """SYNTHETIC_DEFAULTS mode produces synthetic dimensions."""
        result = self.adapter.prepare(
            self.request, geometry_source_mode="synthetic_defaults"
        )
        assert result.geometry_source_mode == "synthetic_defaults"
        # Synthetic mode produces living room defaults: 4000 × 3000
        # (since adapter hard-codes living room for now)
        geometry = result.normalized_room.geometry
        assert geometry.boundary[1].x_mm == 4000
        assert geometry.boundary[2].y_mm == 3000
        assert geometry.ceiling_height_mm == 2400

    def test_all_modes_produce_uncertified_geometry(self) -> None:
        """Every mode produces measurement_certified=False (OQ-010 rule)."""
        for mode in [
            "measured",
            "floorplan",
            "inferred_from_image",
            "synthetic_defaults",
        ]:
            result = self.adapter.prepare(
                self.request, geometry_source_mode=mode
            )
            assert result.measurement_certified is False, f"Failed for mode: {mode}"

    def test_all_modes_carry_fake_fixture_source(self) -> None:
        """Every mode is marked as FAKE_FIXTURE source."""
        for mode in [
            "measured",
            "floorplan",
            "inferred_from_image",
            "synthetic_defaults",
        ]:
            result = self.adapter.prepare(
                self.request, geometry_source_mode=mode
            )
            assert result.source == RoomPrepSource.FAKE_FIXTURE

    def test_synthetic_mode_preserves_protected_regions(self) -> None:
        """Protected regions are preserved in synthetic_defaults mode."""
        result = self.adapter.prepare(
            self.request, geometry_source_mode="synthetic_defaults"
        )
        assert len(result.protected_regions) > 0
        assert result.protected_regions[0].region_id is not None


class TestFakeRoomPrepAdapterSyntheticGeometry:
    """Synthetic default geometry production in FakeRoomPrepAdapter."""

    def setup_method(self) -> None:
        self.adapter = FakeRoomPrepAdapter()

    def test_synthetic_geometry_has_standard_ceiling_height(self) -> None:
        """Synthetic geometry uses 2400mm ceiling (7' 10")."""
        result = self.adapter.prepare(
            RoomPrepRequest(room_asset_id="test"),
            geometry_source_mode="synthetic_defaults",
        )
        assert result.normalized_room.geometry.ceiling_height_mm == 2400

    def test_synthetic_geometry_boundary_is_rectangular(self) -> None:
        """Synthetic geometry produces a rectangular boundary."""
        result = self.adapter.prepare(
            RoomPrepRequest(room_asset_id="test"),
            geometry_source_mode="synthetic_defaults",
        )
        boundary = result.normalized_room.geometry.boundary
        # Should have 4 corners
        assert len(boundary) == 4
        # First corner at origin
        assert boundary[0].x_mm == 0
        assert boundary[0].y_mm == 0
        # All coordinates should be positive integers
        for point in boundary:
            assert isinstance(point.x_mm, int)
            assert isinstance(point.y_mm, int)
            assert point.x_mm >= 0
            assert point.y_mm >= 0

    def test_synthetic_geometry_wall_color_is_consistent(self) -> None:
        """Synthetic geometry uses a consistent neutral wall color."""
        result = self.adapter.prepare(
            RoomPrepRequest(room_asset_id="test"),
            geometry_source_mode="synthetic_defaults",
        )
        color = result.normalized_room.recommended_wall_color
        # Light neutral color suitable for demo
        assert color.hex == "#EDE7DD"
        assert color.l_pct == 91


class TestRoomPrepAdapterProvenanceIntegration:
    """Provenance modes integrate correctly with the full render flow."""

    def setup_method(self) -> None:
        self.adapter = FakeRoomPrepAdapter()

    def test_measured_mode_request_produces_measured_response(self) -> None:
        """Measured request → measured response (no coercion)."""
        result = self.adapter.prepare(
            RoomPrepRequest(room_asset_id="asset-1"),
            geometry_source_mode="measured",
        )
        # Mode is preserved, not coerced
        assert result.geometry_source_mode == "measured"
        # Never silently dropped
        assert result.geometry_source_mode is not None

    def test_synthetic_mode_request_produces_synthetic_response(self) -> None:
        """Synthetic request → synthetic response (no coercion)."""
        result = self.adapter.prepare(
            RoomPrepRequest(room_asset_id="asset-1"),
            geometry_source_mode="synthetic_defaults",
        )
        # Mode is preserved, not coerced to measured
        assert result.geometry_source_mode == "synthetic_defaults"
        assert result.geometry_source_mode != "measured"
        # Never silently dropped
        assert result.geometry_source_mode is not None

    def test_provenance_mode_string_is_normalized(self) -> None:
        """Provenance mode uses consistent lowercase string representation."""
        for mode in [
            "measured",
            "floorplan",
            "inferred_from_image",
            "synthetic_defaults",
        ]:
            result = self.adapter.prepare(
                RoomPrepRequest(room_asset_id="test"),
                geometry_source_mode=mode,
            )
            # Matches exactly (no uppercase, no coercion)
            assert result.geometry_source_mode == mode
