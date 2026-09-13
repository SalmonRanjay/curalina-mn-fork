"""`Clock` — the one piece of ambient state `application/` is allowed to
depend on, so that use-case tests can be deterministic without freezing
`datetime.now` globally."""

from __future__ import annotations

from datetime import datetime
from typing import Protocol


class Clock(Protocol):
    def now(self) -> datetime: ...
