"""`Profile` — the design-profile slice recommendation ranks against.

Per `architecture/guides/03_data_contracts.md`'s `DesignProfile` record:
"room_type, style, atmosphere, pattern_level, lifestyle requirements,
furniture_budget, budget_inclusions, room_geometry, retained_items and
preference/hard-constraint distinctions." This packet keeps the subset the
mandatory named tests need (budget boundary, currency mismatch, category
coverage); `room_geometry`/`retained_items`/pattern/lifestyle fields belong
to workflow step 5 (bundle composition, blocked on R03) and are added
additively then, not stubbed here.
"""

from __future__ import annotations

from dataclasses import dataclass

from curalina_recommendation.domain.money import Money


@dataclass(frozen=True, slots=True)
class Profile:
    """A design profile: what to shop for, and the budget to shop within."""

    profile_id: str
    room_type: str
    style: str
    atmosphere: str
    categories: tuple[str, ...]
    budget: Money

    def __post_init__(self) -> None:
        if not self.profile_id.strip():
            raise ValueError("profile_id must not be blank")
        if not self.categories:
            raise ValueError("categories must not be empty")
