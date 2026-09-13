"""Rooms' local asset/review DTOs must not drift from the shared schemas.

`POST /v1/assets` is used by more than one service, so its shape lives in
`ai_services/contracts/v1/schemas/` and rooms is a consumer of it, not an
author (`ai_services/contracts/v1/CONTRIBUTING.md`; ADR-0003). Reading the
shared schema here is the "producers and consumers test shared fixtures
independently" rule from `architecture/guides/03_data_contracts.md`, not a
cross-service code dependency: the file read is a versioned contract
document, and nothing is imported from another service's package.

The one deliberate, recorded exception is `width_px`/`height_px`, which the
shared schema requires and rooms' A1 fake leaves nullable because it does
not decode image bytes and must not invent pixel dimensions. See ADR-0003.
"""

import json
from pathlib import Path
from typing import Any

from curalina_rooms.api.schemas import AssetResponse, CandidateReviewResponse

_SCHEMAS = Path(__file__).resolve().parents[3] / "contracts" / "v1" / "schemas"

# Recorded, ADR-0003-sanctioned gap: nullable in rooms' A1 fake, required
# by the shared schema; closes at A2 when a real importer decodes uploads.
_KNOWN_NULLABLE_AT_A1 = {"width_px", "height_px"}


def _shared(name: str) -> dict[str, Any]:
    payload: dict[str, Any] = json.loads(
        (_SCHEMAS / name).read_text(encoding="utf-8")
    )
    return payload


def test_asset_response_exposes_no_field_the_shared_schema_forbids() -> None:
    schema = _shared("asset.schema.json")
    assert schema["additionalProperties"] is False

    allowed = set(schema["properties"])
    local = set(AssetResponse.model_fields)

    assert local - allowed == set(), (
        "rooms exposes fields the shared Asset schema forbids "
        "(storage keys are internal and are never serialized)"
    )


def test_asset_response_carries_every_required_shared_field() -> None:
    required = set(_shared("asset.schema.json")["required"])
    local = set(AssetResponse.model_fields)

    assert required - local == set()


def test_asset_provenance_is_a_string_not_an_object() -> None:
    assert _shared("asset.schema.json")["properties"]["provenance"]["type"] == "string"
    assert AssetResponse.model_fields["provenance"].annotation is str


def test_review_response_matches_the_shared_review_field_set() -> None:
    schema = _shared("review.schema.json")
    required = set(schema["required"])
    local = set(CandidateReviewResponse.model_fields)

    assert required - local == set()
    assert local - set(schema["properties"]) == set()


def test_review_decision_has_exactly_the_shared_two_outcomes() -> None:
    schema = _shared("review.schema.json")
    shared_decisions = set(schema["properties"]["decision"]["enum"])
    annotation = CandidateReviewResponse.model_fields["decision"].annotation
    local_decisions = set(getattr(annotation, "__args__", ()))

    assert local_decisions == shared_decisions == {"approved", "rejected"}


def test_the_only_nullability_gap_is_the_recorded_one() -> None:
    """Guards the exception itself, so it cannot quietly grow."""

    required = set(_shared("asset.schema.json")["required"])
    nullable_locally = {
        name
        for name, field in AssetResponse.model_fields.items()
        if not field.is_required() and field.default is None
    }

    assert nullable_locally & required == _KNOWN_NULLABLE_AT_A1
