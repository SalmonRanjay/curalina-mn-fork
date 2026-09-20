"""Port for storing and retrieving human-authored masks.

This port defines the interface for a mask repository that persists masks
ingested via `POST /v1/masks`. Masks come from external tools (labelme,
notebook polygon tools) and must be resolved by ID when creating variant jobs.

Per `agentic_flow/variant_generator_workflow.md`, masks are human-authored
artifacts with explicit per-region editable/protected regions, not auto-generated.
"""

from __future__ import annotations

from abc import ABC, abstractmethod

from curalina_variants.domain.mask_spec import Mask


class MaskRepository(ABC):
    """Interface for persisting and retrieving human-authored masks."""

    @abstractmethod
    def store_mask(self, mask: Mask, *, request_id: str) -> None:
        """Persist a mask record.

        Raises if the mask_id already exists (idempotency: resubmitting the
        same request should not duplicate the record, but that is the
        caller's responsibility via idempotency keys, not this method's).
        """
        raise NotImplementedError

    @abstractmethod
    def get_mask(self, mask_id: str, *, request_id: str) -> Mask | None:
        """Retrieve a mask by ID, or None if not found.

        Returns the persisted Mask domain object, which contains all fields
        needed by the colour-transfer pipeline: dimensions, editable array,
        protected subregions, feather policy, and revision tracking.
        """
        raise NotImplementedError
