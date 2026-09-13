"""Commercial-availability state — separate from job outcome and candidate
review. Per `agentic_flow/15_variant_generation_technical_design.md`:
approval creates an exportable visual variant; custom-order additionally
requires a confirmed quote and fulfilment eligibility. Never inferred from
job success or review approval alone."""

from __future__ import annotations

from enum import StrEnum


class CommercialAvailability(StrEnum):
    CONCEPTUAL = "conceptual"
    CUSTOM_ORDER = "custom_order"
    SUPPLIER_CONFIRMED = "supplier_confirmed"
