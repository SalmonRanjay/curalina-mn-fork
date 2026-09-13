"""Deterministic `Clock` implementations for tests and fake wiring."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime


@dataclass(frozen=True)
class FixedClock:
    """Always returns the same instant. Deterministic and fast."""

    fixed_now: datetime

    def now(self) -> datetime:
        return self.fixed_now
