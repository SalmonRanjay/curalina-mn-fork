import pytest
from factories import make_normalized_room

from curalina_rooms.domain.room_prep import RoomPrepResult, RoomPrepSource


def test_room_prep_result_rejects_certified_measurement() -> None:
    """OQ-010 is unresolved: no single photograph certifies physical
    dimensions, so `measurement_certified=True` must be refused regardless
    of `source` (`agentic_flow/14_room_generation_technical_design.md`)."""

    with pytest.raises(ValueError, match="OQ-010"):
        RoomPrepResult(
            normalized_room=make_normalized_room(),
            protected_regions=(),
            homography_reference=None,
            measurement_certified=True,
            source=RoomPrepSource.CUSTOMER_CONFIRMED,
        )


def test_room_prep_result_accepts_uncertified_measurement() -> None:
    result = RoomPrepResult(
        normalized_room=make_normalized_room(),
        protected_regions=(),
        homography_reference=None,
        measurement_certified=False,
        source=RoomPrepSource.FAKE_FIXTURE,
    )
    assert result.measurement_certified is False
