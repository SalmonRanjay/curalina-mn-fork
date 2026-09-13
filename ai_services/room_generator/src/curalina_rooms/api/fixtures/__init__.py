"""Loader for the JSON fixtures backing the A1 contract surface.

Every fixture here is a fake, deterministic example: no network fetch, no
model weights, no customer data. They exist so contract tests and the fake
`RoomsContractService` share one source of truth for valid and invalid
request/response shapes.
"""

from __future__ import annotations

import json
from importlib import resources
from typing import Any

_PACKAGE = "curalina_rooms.api.fixtures"


def load_fixture(name: str) -> dict[str, Any]:
    """Load and parse a JSON fixture file by name (e.g. ``"seed_assets.json"``).

    Every fixture in this package is a top-level JSON object, matching the
    `/v1` request/response shapes it represents.
    """

    with resources.files(_PACKAGE).joinpath(name).open("r", encoding="utf-8") as fh:
        data: dict[str, Any] = json.load(fh)
        return data
