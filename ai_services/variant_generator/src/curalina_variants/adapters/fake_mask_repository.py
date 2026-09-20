"""In-memory fake mask repository for A1 contract testing and demos."""

from __future__ import annotations

from curalina_variants.domain.mask_spec import Mask
from curalina_variants.ports.mask_repository import MaskRepository


class FakeMaskRepository(MaskRepository):
    """Deterministic, in-process fake for mask storage.

    Used during A1 and A2 testing before a durable mask repository is
    built. Masks are stored in memory and lost on process restart.
    """

    def __init__(self) -> None:
        self._masks: dict[str, Mask] = {}

    def store_mask(self, mask: Mask, *, request_id: str) -> None:
        """Store a mask by its mask_id.

        Does not check for duplicates; overwrites if mask_id exists.
        Real implementations (A3+) would enforce idempotency or use a
        database constraint.
        """
        self._masks[mask.mask_id] = mask

    def get_mask(self, mask_id: str, *, request_id: str) -> Mask | None:
        """Retrieve a mask by ID, or None if not found."""
        return self._masks.get(mask_id)
