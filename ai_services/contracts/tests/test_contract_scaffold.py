import json
from pathlib import Path


def test_error_schema_declares_canonical_fields() -> None:
    schema_path = Path(__file__).parents[1] / "v1" / "schemas" / "error.schema.json"
    schema = json.loads(schema_path.read_text(encoding="utf-8"))

    assert schema["required"] == [
        "code",
        "message",
        "details",
        "retryable",
        "request_id",
    ]
    assert schema["additionalProperties"] is False


def test_contract_conventions_are_documented() -> None:
    conventions = (
        Path(__file__).parents[1] / "v1" / "id_versioning.md"
    ).read_text(encoding="utf-8")

    assert "`schema_version` with value `1.0`" in conventions
    assert "Unsupported major versions" in conventions
    assert "sha256:" in conventions
