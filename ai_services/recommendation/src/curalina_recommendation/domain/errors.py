"""Typed domain exceptions.

Per `architecture/guides/08_engineering_and_tests.md`: "use typed
exceptions for invalid input, no feasible result, missing asset, model
unavailable and retryable infrastructure failure." These are the
domain-level ones recommendation needs for A2's typed records; the
application layer lets them propagate to entry points rather than
swallowing them, and `api/` (a later concern) is responsible for mapping
them onto the shared HTTP error vocabulary.
"""

from __future__ import annotations


class DomainError(Exception):
    """Base type for every invalid-domain-state error in this service."""


class CurrencyMismatchError(DomainError):
    """Raised when an operation compares or combines two different currencies.

    Per `03_data_contracts.md`: currency is required and explicit, never
    inferred; two `Money` values of different currencies are never
    comparable or combinable.
    """

    def __init__(self, expected: str, actual: str) -> None:
        super().__init__(
            f"currency mismatch: expected {expected!r}, got {actual!r}"
        )
        self.expected = expected
        self.actual = actual


class InvalidSkuError(DomainError):
    """Raised when a supplier SKU is blank or whitespace-only after
    Unicode normalization.

    Per `03_data_contracts.md`: "Normalize Unicode whitespace; retain
    original SKU." A SKU that normalizes to the empty string carries no
    usable identity and must be rejected rather than silently accepted as
    an empty key.
    """

    def __init__(self, raw_sku: str) -> None:
        super().__init__(
            f"SKU {raw_sku!r} is blank or whitespace-only after normalization"
        )
        self.raw_sku = raw_sku


class DuplicateProductKeyError(DomainError):
    """Raised when two products share a compound (supplier_id, sku) key.

    Per `03_data_contracts.md`: "reject duplicate compound keys unless
    explicit variant relationship." This service has no variant
    relationship concept yet, so every duplicate is rejected.
    """

    def __init__(self, supplier_id: str, normalized_sku: str) -> None:
        super().__init__(
            f"duplicate product key: supplier_id={supplier_id!r}, "
            f"sku={normalized_sku!r}"
        )
        self.supplier_id = supplier_id
        self.normalized_sku = normalized_sku


class MissingRequiredFactError(DomainError):
    """Raised when a `Product` is constructed with commercial facts that
    are internally inconsistent with its declared availability.

    Per `03_data_contracts.md`: "Missing critical commercial facts produce
    `unknown`, not `available`." A product may not declare itself
    `available` while missing the price or dimensions that availability
    implies were confirmed.
    """

    def __init__(self, product_id: str, missing_fact: str) -> None:
        super().__init__(
            f"product {product_id!r} is missing required fact "
            f"{missing_fact!r} for its declared availability"
        )
        self.product_id = product_id
        self.missing_fact = missing_fact
