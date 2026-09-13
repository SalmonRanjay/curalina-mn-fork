"""`Money` value object.

Per the project stack decision (`agent_instructions/01_recommendation_service.md`,
`agentic_flow/00_AUDIT_AND_STACK_DECISIONS.md`) and
`architecture/guides/03_data_contracts.md` ("Serialize money amounts as
decimal strings or integer minor units; never binary float totals"), money
is always `decimal.Decimal` with an explicit ISO 4217 currency — never a
bare float, and never a currency inferred from context.
"""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal

from curalina_recommendation.domain.errors import CurrencyMismatchError

_MINOR_UNITS_PER_MAJOR = Decimal(100)


@dataclass(frozen=True, slots=True)
class Money:
    """An exact decimal amount in a specific currency.

    `amount` is always major units (e.g. `Decimal("19.99")` for $19.99),
    kept as `Decimal` throughout the domain; conversion to/from integer
    minor units (matching the wire contract) happens only at the
    boundary via `from_minor_units`/`to_minor_units`.
    """

    amount: Decimal
    currency: str

    def __post_init__(self) -> None:
        if not isinstance(self.amount, Decimal):
            raise TypeError(
                "Money.amount must be a decimal.Decimal, never float/int"
            )
        if len(self.currency) != 3 or not self.currency.isalpha():
            raise ValueError(
                f"currency must be a 3-letter ISO 4217 code, got {self.currency!r}"
            )
        object.__setattr__(self, "currency", self.currency.upper())

    @classmethod
    def from_minor_units(cls, minor_units: int, currency: str) -> Money:
        return cls(Decimal(minor_units) / _MINOR_UNITS_PER_MAJOR, currency)

    def to_minor_units(self) -> int:
        return int((self.amount * _MINOR_UNITS_PER_MAJOR).to_integral_value())

    def _check_same_currency(self, other: Money) -> None:
        if self.currency != other.currency:
            raise CurrencyMismatchError(self.currency, other.currency)

    def __add__(self, other: Money) -> Money:
        self._check_same_currency(other)
        return Money(self.amount + other.amount, self.currency)

    def __mul__(self, quantity: int) -> Money:
        if not isinstance(quantity, int) or isinstance(quantity, bool):
            raise TypeError("Money may only be multiplied by an int quantity")
        if quantity < 0:
            raise ValueError("quantity must be >= 0")
        return Money(self.amount * quantity, self.currency)

    __rmul__ = __mul__

    def __lt__(self, other: Money) -> bool:
        self._check_same_currency(other)
        return self.amount < other.amount

    def __le__(self, other: Money) -> bool:
        self._check_same_currency(other)
        return self.amount <= other.amount

    def __gt__(self, other: Money) -> bool:
        self._check_same_currency(other)
        return self.amount > other.amount

    def __ge__(self, other: Money) -> bool:
        self._check_same_currency(other)
        return self.amount >= other.amount


def sum_money(amounts: tuple[Money, ...], *, currency: str) -> Money:
    """Sum a sequence of `Money`, asserting every element shares `currency`.

    Used for bundle/quantity totals. Raises `CurrencyMismatchError` on the
    first mismatched element rather than silently coercing or dropping it.
    """

    total = Money(Decimal(0), currency)
    for amount in amounts:
        total = total + amount
    return total
