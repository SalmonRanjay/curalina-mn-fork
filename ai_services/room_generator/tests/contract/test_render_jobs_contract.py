"""Contract tests for `POST /v1/render-jobs` and the job lifecycle.

Uses `RoomsContractService` — the fixture-backed fake — directly, since A1
implements contracts, not the ASGI transport (that is A3). No rendering,
model, or GPU logic is exercised.
"""

import pytest

from curalina_rooms.api.errors import ContractError
from curalina_rooms.api.fixtures import load_fixture
from curalina_rooms.api.schemas import RenderJobResponse
from curalina_rooms.api.service import RoomsContractService


@pytest.fixture
def service() -> RoomsContractService:
    return RoomsContractService()


def test_valid_render_job_request_is_accepted_with_202_and_location(
    service: RoomsContractService,
) -> None:
    payload = load_fixture("render_job_request_valid.json")

    result = service.create_render_job(payload)

    assert result.http_status == 202
    assert isinstance(result.body, RenderJobResponse)
    assert result.body.status == "queued"
    assert result.headers["Location"] == result.body.location
    assert result.body.job_id.startswith("job_")


def test_stale_bundle_revision_returns_409(service: RoomsContractService) -> None:
    payload = load_fixture("render_job_request_stale_revision.json")

    with pytest.raises(ContractError) as excinfo:
        service.create_render_job(payload)

    error = excinfo.value
    assert error.http_status == 409
    assert error.error.code == "stale_bundle_revision"
    assert error.error.retryable is False
    assert error.error.request_id


def test_missing_reference_image_returns_422_not_a_silent_guess(
    service: RoomsContractService,
) -> None:
    payload = load_fixture("render_job_request_missing_reference.json")

    with pytest.raises(ContractError) as excinfo:
        service.create_render_job(payload)

    error = excinfo.value
    assert error.http_status == 422
    assert error.error.code == "missing_reference_image"
    assert error.error.details["asset_id"] == "asset_not_imported_999"


def test_unsupported_major_schema_version_returns_422(
    service: RoomsContractService,
) -> None:
    payload = load_fixture("render_job_request_unsupported_version.json")

    with pytest.raises(ContractError) as excinfo:
        service.create_render_job(payload)

    error = excinfo.value
    assert error.http_status == 422
    assert error.error.code == "unsupported_schema_version"


def test_missing_required_field_returns_structured_400_not_500(
    service: RoomsContractService,
) -> None:
    payload = load_fixture("render_job_request_missing_field.json")

    with pytest.raises(ContractError) as excinfo:
        service.create_render_job(payload)

    error = excinfo.value
    assert error.http_status == 400
    assert error.error.code == "malformed_request"
    assert error.error.details["validation_errors"]


def test_unknown_bundle_returns_404(service: RoomsContractService) -> None:
    payload = load_fixture("render_job_request_valid.json")
    payload = {
        **payload,
        "bundle": {"bundle_id": "bundle_missing", "bundle_revision": "rev_001"},
    }

    with pytest.raises(ContractError) as excinfo:
        service.create_render_job(payload)

    assert excinfo.value.http_status == 404
    assert excinfo.value.error.code == "unknown_bundle"


def test_job_lifecycle_queued_then_get_then_cancel(
    service: RoomsContractService,
) -> None:
    created = service.create_render_job(load_fixture("render_job_request_valid.json"))
    job_id = created.body.job_id

    status_result = service.get_job(job_id)
    assert status_result.http_status == 200
    assert status_result.body.status == "queued"
    assert status_result.body.attempt_count == 0

    cancel_result = service.cancel_job(job_id)
    assert cancel_result.http_status == 200
    assert cancel_result.body.status == "cancelled"
    assert cancel_result.body.cooperative is True

    after_cancel = service.get_job(job_id)
    assert after_cancel.body.status == "cancelled"


def test_get_unknown_job_returns_404(service: RoomsContractService) -> None:
    with pytest.raises(ContractError) as excinfo:
        service.get_job("job_does_not_exist")

    assert excinfo.value.http_status == 404
    assert excinfo.value.error.code == "resource_not_found"


def test_cancel_unknown_job_returns_404(service: RoomsContractService) -> None:
    with pytest.raises(ContractError) as excinfo:
        service.cancel_job("job_does_not_exist")

    assert excinfo.value.http_status == 404
