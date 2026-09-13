"""The candidate-review state — separate from job outcome and commercial
status. See `variant_candidate.py` and `commercial_status.py` for the other
two of the three states this service must never collapse together."""

from __future__ import annotations

from enum import StrEnum


class ReviewDecision(StrEnum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
