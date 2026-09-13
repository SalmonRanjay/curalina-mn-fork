"""`Bundle` and `BundleLineItem`.

Per `architecture/guides/03_data_contracts.md`'s `Bundle` record:
"immutable bundle_id/revision, profile snapshot, catalogue snapshot, rule
version, line items including quantity and chosen variant, per-line and
total costs, completeness, violations, warnings and layout." Layout
(physical placements) is workflow step 5's real logic, blocked on R03 and
delegated to `curalina_design_rules` (see `ports/bundle_composer.py`); it
is intentionally absent from this record until that step exists. "A chair
quantity of two is intentional repetition" — `BundleLineItem.quantity`
exists precisely so callers can express that without duplicating a line.
"""

from __future__ import annotations

from dataclasses import dataclass

from curalina_recommendation.domain.money import Money, sum_money


@dataclass(frozen=True, slots=True)
class BundleLineItem:
    """One product, at a quantity, at the unit price it was chosen at."""

    product_id: str
    category: str
    quantity: int
    unit_price: Money

    def __post_init__(self) -> None:
        if self.quantity < 1:
            raise ValueError(f"quantity must be >= 1, got {self.quantity}")

    @property
    def line_total(self) -> Money:
        return self.unit_price * self.quantity


@dataclass(frozen=True, slots=True)
class Bundle:
    """An immutable bundle revision.

    Per the contract's export/import rule, `bundle_id` is stable across
    revisions and `revision` increments; a substitution (workflow step 5)
    produces a *new* `Bundle` with the same `bundle_id` and a higher
    `revision`, never a mutation of this one.
    """

    bundle_id: str
    revision: int
    profile_snapshot_id: str
    catalogue_snapshot_id: str
    rules_version: str
    currency: str
    line_items: tuple[BundleLineItem, ...]
    feasible: bool
    violations: tuple[str, ...] = ()
    warnings: tuple[str, ...] = ()

    def __post_init__(self) -> None:
        if self.revision < 1:
            raise ValueError(f"revision must be >= 1, got {self.revision}")
        if self.feasible and self.violations:
            raise ValueError("a feasible bundle must not carry violations")

    @property
    def total(self) -> Money:
        """Sum of every line's `quantity * unit_price`, in `self.currency`.

        Raises `CurrencyMismatchError` (via `sum_money`) if any line item's
        currency does not match the bundle's declared currency — quantity
        totals are never computed across mismatched currencies.
        """

        line_totals = tuple(item.line_total for item in self.line_items)
        return sum_money(line_totals, currency=self.currency)

    @property
    def total_quantity(self) -> int:
        return sum(item.quantity for item in self.line_items)
