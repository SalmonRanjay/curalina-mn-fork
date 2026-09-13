"""Availability and eligibility-reason vocabulary.

Per `architecture/guides/03_data_contracts.md`: "Missing critical
commercial facts produce `unknown`, not `available`" and
`agent_instructions/01_recommendation_service.md`: "Never fabricate a
valid recommendation in shoppable mode using fallback products." These
enums give the rest of the domain/application a closed, typed vocabulary
for those states instead of ad hoc strings.
"""

from __future__ import annotations

from enum import StrEnum


class Availability(StrEnum):
    """A product's commercial availability, as a closed three-state value.

    `UNKNOWN` is the only legal value when a required commercial fact
    (price, in-stock status, etc.) was not confirmed by the source data —
    it must never be upgraded to `AVAILABLE` by a fallback or a default.
    """

    AVAILABLE = "available"
    UNAVAILABLE = "unavailable"
    UNKNOWN = "unknown"


class EligibilityReason(StrEnum):
    """Closed vocabulary of reasons a candidate was included, scored, or
    excluded, surfaced to callers instead of a free-text explanation.
    """

    MISSING_PRICE = "missing_price"
    MISSING_AVAILABILITY_FACT = "missing_availability_fact"
    MISSING_DIMENSIONS = "missing_dimensions"
    CURRENCY_MISMATCH = "currency_mismatch"
    OVER_BUDGET = "over_budget"
    WITHIN_BUDGET = "within_budget"
    CATEGORY_MATCH = "category_match"
    CATEGORY_NOT_REQUESTED = "category_not_requested"
    DUPLICATE_PRODUCT_KEY = "duplicate_product_key"
    INVALID_SKU = "invalid_sku"
    UNAVAILABLE = "unavailable"
