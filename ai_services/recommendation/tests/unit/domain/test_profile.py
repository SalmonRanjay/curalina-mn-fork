"""`Profile` invariant tests (blank id, empty categories)."""

from __future__ import annotations

from decimal import Decimal

import pytest

from curalina_recommendation.domain.money import Money
from curalina_recommendation.domain.profile import Profile


def test_profile_rejects_blank_profile_id() -> None:
    with pytest.raises(ValueError):
        Profile(
            profile_id="   ",
            room_type="living_room",
            style="contemporary_luxe",
            atmosphere="bright_airy",
            categories=("sofa",),
            budget=Money(Decimal("100.00"), "USD"),
        )


def test_profile_rejects_empty_categories() -> None:
    with pytest.raises(ValueError):
        Profile(
            profile_id="profile-1",
            room_type="living_room",
            style="contemporary_luxe",
            atmosphere="bright_airy",
            categories=(),
            budget=Money(Decimal("100.00"), "USD"),
        )
