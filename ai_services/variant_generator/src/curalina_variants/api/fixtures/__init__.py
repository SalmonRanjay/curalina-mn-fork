"""Loader for JSON contract fixtures backing A1 contract tests.

Fixtures live as plain JSON files next to this module rather than inline in
test code so producers and consumers can diff shared shapes, per
`ai_services/contracts/v1/CONTRIBUTING.md`'s "Producers and consumers test
shared fixtures independently."
"""

from __future__ import annotations

import json
from importlib import resources
from typing import Any

_PACKAGE = "curalina_variants.api.fixtures"


def load_fixture(name: str) -> dict[str, Any]:
    """Load a JSON fixture by filename stem.

    E.g. `load_fixture("create_variant_job_request")`.
    """

    raw = (
        resources.files(_PACKAGE)
        .joinpath(f"{name}.json")
        .read_text(encoding="utf-8")
    )
    data: dict[str, Any] = json.loads(raw)
    return data


def load_asset_request_payload(name: str) -> dict[str, Any]:
    """Load a `create_asset_request`-shaped fixture, decoding its
    human-readable `content_text` field into the `content_bytes` field
    `CreateAssetRequest` expects."""

    payload = load_fixture(name)
    content_text = payload.pop("content_text")
    payload["content_bytes"] = content_text.encode("utf-8")
    return payload
