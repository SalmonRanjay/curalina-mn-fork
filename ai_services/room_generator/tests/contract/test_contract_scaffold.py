"""Error-vocabulary parity between this service and the shared contract.

A0 shipped this file as a placeholder ("passes until A1"). A1 replaces the
placeholder with a real assertion: this service's `ErrorResponse` DTO must
match `ai_services/contracts/v1/schemas/error.schema.json` field-for-field,
since `contracts-qa-steward` checks that all three AI services use the
shared error shape identically.
"""

import json
from pathlib import Path

from curalina_rooms.api.schemas import ErrorResponse


def _shared_error_schema() -> dict[str, object]:
    schema_path = (
        Path(__file__).parents[3] / "contracts" / "v1" / "schemas" / "error.schema.json"
    )
    return json.loads(schema_path.read_text(encoding="utf-8"))


def test_error_response_matches_shared_error_schema_fields() -> None:
    schema = _shared_error_schema()

    assert set(ErrorResponse.model_fields.keys()) == set(schema["required"])
    assert schema["required"] == [
        "code",
        "message",
        "details",
        "retryable",
        "request_id",
    ]


def test_error_response_rejects_unknown_fields() -> None:
    payload = {
        "code": "x",
        "message": "y",
        "details": {},
        "retryable": False,
        "request_id": "req_1",
        "unexpected": "nope",
    }

    try:
        ErrorResponse.model_validate(payload)
    except Exception as exc:  # noqa: BLE001 - assert the shape, not the type
        assert "unexpected" in str(exc) or "extra" in str(exc).lower()
    else:  # pragma: no cover - defensive
        raise AssertionError("expected validation to reject an unknown field")
