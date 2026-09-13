"""Contract tests for `POST /v1/candidates/{id}/reviews`."""

import pytest

from curalina_rooms.api.errors import ContractError
from curalina_rooms.api.fixtures import load_fixture
from curalina_rooms.api.schemas import CandidateReviewResponse
from curalina_rooms.api.service import RoomsContractService

SEEDED_CANDIDATE_ID = "cand_render000001"


@pytest.fixture
def service() -> RoomsContractService:
    return RoomsContractService()


def test_valid_review_with_matching_version_is_accepted(
    service: RoomsContractService,
) -> None:
    payload = load_fixture("candidate_review_request.json")

    result = service.create_candidate_review(SEEDED_CANDIDATE_ID, payload)

    assert result.http_status == 201
    assert isinstance(result.body, CandidateReviewResponse)
    assert result.body.candidate_id == SEEDED_CANDIDATE_ID
    assert result.body.review_version == 2


def test_review_with_stale_version_returns_409_conflict(
    service: RoomsContractService,
) -> None:
    payload = {
        **load_fixture("candidate_review_request.json"),
        "expected_review_version": 99,
    }

    with pytest.raises(ContractError) as excinfo:
        service.create_candidate_review(SEEDED_CANDIDATE_ID, payload)

    error = excinfo.value
    assert error.http_status == 409
    assert error.error.code == "review_version_conflict"


def test_review_for_unknown_candidate_returns_404(
    service: RoomsContractService,
) -> None:
    payload = load_fixture("candidate_review_request.json")

    with pytest.raises(ContractError) as excinfo:
        service.create_candidate_review("cand_does_not_exist", payload)

    assert excinfo.value.http_status == 404
    assert excinfo.value.error.code == "resource_not_found"


def test_a_rejection_does_not_rewrite_earlier_review_history(
    service: RoomsContractService,
) -> None:
    approve_payload = load_fixture("candidate_review_request.json")
    approved = service.create_candidate_review(SEEDED_CANDIDATE_ID, approve_payload)
    assert approved.body.decision == "approved"
    assert approved.body.review_version == 2

    reject_payload = {
        **approve_payload,
        "decision": "rejected",
        "expected_review_version": 2,
        "notes": "Colour drifted from the approved variant.",
    }
    rejected = service.create_candidate_review(SEEDED_CANDIDATE_ID, reject_payload)

    assert rejected.body.decision == "rejected"
    assert rejected.body.review_version == 3
    assert approved.body.review_version == 2  # earlier record is untouched


def test_missing_required_field_returns_structured_400(
    service: RoomsContractService,
) -> None:
    payload = load_fixture("candidate_review_request.json")
    del payload["decision"]

    with pytest.raises(ContractError) as excinfo:
        service.create_candidate_review(SEEDED_CANDIDATE_ID, payload)

    assert excinfo.value.http_status == 400
    assert excinfo.value.error.code == "malformed_request"
