"""Contract tests for `POST /v1/assets` import and `GET /v1/assets/{id}/content`."""

import pytest

from curalina_rooms.api.errors import ContractError
from curalina_rooms.api.fixtures import load_fixture
from curalina_rooms.api.schemas import AssetContentResponse, AssetResponse
from curalina_rooms.api.service import RoomsContractService


@pytest.fixture
def service() -> RoomsContractService:
    return RoomsContractService()


def test_valid_asset_import_returns_201_with_metadata(
    service: RoomsContractService,
) -> None:
    payload = load_fixture("asset_import_request.json")

    result = service.import_asset(payload)

    assert result.http_status == 201
    assert isinstance(result.body, AssetResponse)
    assert result.body.asset_id.startswith("asset_")
    assert result.body.content_hash.startswith("sha256:")
    assert result.body.owner_id == payload["owner_id"]


def test_asset_import_is_deterministic_for_the_same_payload(
    service: RoomsContractService,
) -> None:
    payload = load_fixture("asset_import_request.json")

    first = service.import_asset(payload)
    second = service.import_asset(payload)

    assert first.body.content_hash == second.body.content_hash


def test_asset_import_unsupported_schema_version_returns_422(
    service: RoomsContractService,
) -> None:
    payload = {**load_fixture("asset_import_request.json"), "schema_version": "9.0"}

    with pytest.raises(ContractError) as excinfo:
        service.import_asset(payload)

    assert excinfo.value.http_status == 422
    assert excinfo.value.error.code == "unsupported_schema_version"


def test_asset_import_missing_required_field_returns_400(
    service: RoomsContractService,
) -> None:
    payload = load_fixture("asset_import_request.json")
    del payload["owner_id"]

    with pytest.raises(ContractError) as excinfo:
        service.import_asset(payload)

    assert excinfo.value.http_status == 400
    assert excinfo.value.error.code == "malformed_request"


def test_get_content_for_seeded_asset_returns_200(
    service: RoomsContractService,
) -> None:
    result = service.get_asset_content("asset_room000001")

    assert result.http_status == 200
    assert isinstance(result.body, AssetContentResponse)
    assert result.body.content_ref.startswith("content://")
    assert "asset_room000001" in result.body.content_ref or result.body.asset_id == (
        "asset_room000001"
    )


def test_get_content_for_unknown_asset_returns_404(
    service: RoomsContractService,
) -> None:
    with pytest.raises(ContractError) as excinfo:
        service.get_asset_content("asset_never_imported")

    assert excinfo.value.http_status == 404
    assert excinfo.value.error.code == "resource_not_found"


def test_imported_asset_is_available_as_a_render_job_reference(
    service: RoomsContractService,
) -> None:
    imported = service.import_asset(load_fixture("asset_import_request.json"))

    payload = load_fixture("render_job_request_valid.json")
    payload = {
        **payload,
        "reference_images": [
            {"asset_id": "asset_room000001", "role": "room_photo"},
            {"asset_id": imported.body.asset_id, "role": "hero_product"},
        ],
    }

    result = service.create_render_job(payload)
    assert result.http_status == 202
