"""A1 contract tests for the variant-generator `/v1` surface.

These exercise the plain-callable handlers in `curalina_variants.api.handlers`
against `curalina_variants.api.store.FakeJobStore`. No ASGI app, no SQLite, no
image bytes are decoded — that is A2/A3 scope. What is under test here is the
wire contract: status codes, the error vocabulary
(`code, message, details, retryable, request_id`), the job state machine, and
idempotency-key behaviour, all per `architecture/guides/03_data_contracts.md`.
"""

from __future__ import annotations

import base64

import pytest

from curalina_variants.api import handlers
from curalina_variants.api.errors import ApiError
from curalina_variants.api.fixtures import load_asset_request_payload, load_fixture
from curalina_variants.api.schemas import CreateMaskRequest, JobStatus, ReviewStatus
from curalina_variants.api.store import MAX_ASSET_BYTES, FakeJobStore


@pytest.fixture
def store() -> FakeJobStore:
    store = FakeJobStore()
    # Seed the default mask that create_variant_job_request.json expects,
    # per the mask-existence gate added in VAR-A2-03.
    mask_request = CreateMaskRequest(
        mask_id="mask_000001",
        source_asset_id="asset_000001",
        width_px=2,
        height_px=2,
        editable_mask_b64=base64.b64encode(bytes([1, 1, 1, 1])).decode("utf-8"),
        protected_subregions=[],
        feather_band_px=3,
        human_corrected=False,
        revision=1,
    )
    store.create_mask(mask_request, request_id="fixture-setup")
    return store


def test_create_asset_returns_201_with_public_fields_only(store: FakeJobStore) -> None:
    payload = load_asset_request_payload("create_asset_request")

    response = handlers.create_asset(store, payload, request_id="req-1")

    assert response.status_code == 201
    assert response.body.asset_id.startswith("asset_")
    assert response.body.content_hash.startswith("sha256:")
    # Storage keys are internal per 03_data_contracts.md and must never
    # appear on the public AssetRecord DTO.
    assert not hasattr(response.body, "storage_key")


def test_create_asset_oversized_upload_returns_413(store: FakeJobStore) -> None:
    payload = load_asset_request_payload("create_asset_request")
    payload["content_bytes"] = b"x" * (MAX_ASSET_BYTES + 1)

    with pytest.raises(ApiError) as exc_info:
        handlers.create_asset(store, payload, request_id="req-2")

    assert exc_info.value.status_code == 413
    assert exc_info.value.body.retryable is False
    assert exc_info.value.body.request_id == "req-2"


def test_create_asset_missing_required_field_is_structured_422_not_500(
    store: FakeJobStore,
) -> None:
    payload = load_asset_request_payload("create_asset_request")
    del payload["owner_id"]

    with pytest.raises(ApiError) as exc_info:
        handlers.create_asset(store, payload, request_id="req-3")

    error = exc_info.value.body
    assert exc_info.value.status_code == 422
    assert error.code == "validation_error"
    assert error.message
    assert error.details
    assert error.retryable is False
    assert error.request_id == "req-3"


def test_get_asset_content_round_trips_uploaded_bytes(store: FakeJobStore) -> None:
    create_payload = load_asset_request_payload("create_asset_request")
    created = handlers.create_asset(store, create_payload, request_id="req-4")

    response = handlers.get_asset_content(
        store, created.body.asset_id, request_id="req-5"
    )

    assert response.status_code == 200
    assert response.body.content_bytes == create_payload["content_bytes"]
    assert response.body.media_type == "image/png"


def test_get_asset_content_unknown_id_returns_404(store: FakeJobStore) -> None:
    with pytest.raises(ApiError) as exc_info:
        handlers.get_asset_content(store, "asset_999999", request_id="req-6")

    assert exc_info.value.status_code == 404
    assert exc_info.value.body.code == "not_found"


def test_unsupported_schema_major_version_returns_422(store: FakeJobStore) -> None:
    payload = load_fixture("unsupported_version_variant_job_request")

    with pytest.raises(ApiError) as exc_info:
        handlers.create_variant_job(
            store, payload, idempotency_key="idem-1", request_id="req-7"
        )

    error = exc_info.value.body
    assert exc_info.value.status_code == 422
    assert error.code == "unsupported_schema_version"
    assert error.retryable is False
    assert error.request_id == "req-7"


@pytest.mark.parametrize(
    "malformed_version", ["not-a-version", "one.0", 2, None], ids=str
)
def test_malformed_schema_version_returns_422_not_500(
    store: FakeJobStore, malformed_version: object
) -> None:
    payload = dict(
        load_fixture("create_variant_job_request"), schema_version=malformed_version
    )

    with pytest.raises(ApiError) as exc_info:
        handlers.create_variant_job(
            store, payload, idempotency_key="idem-malformed", request_id="req-malformed"
        )

    assert exc_info.value.status_code == 422
    assert exc_info.value.body.code == "unsupported_schema_version"


def test_variant_job_missing_required_field_is_structured_422_not_500(
    store: FakeJobStore,
) -> None:
    payload = load_fixture("missing_field_variant_job_request")

    with pytest.raises(ApiError) as exc_info:
        handlers.create_variant_job(
            store, payload, idempotency_key="idem-2", request_id="req-8"
        )

    error = exc_info.value.body
    assert exc_info.value.status_code == 422
    assert error.code == "validation_error"
    assert "source_asset_id" in error.message or error.details


def test_create_variant_job_returns_202_with_location_header(
    store: FakeJobStore,
) -> None:
    payload = load_fixture("create_variant_job_request")

    response = handlers.create_variant_job(
        store, payload, idempotency_key="idem-3", request_id="req-9"
    )

    assert response.status_code == 202
    assert response.headers["Location"] == f"/v1/jobs/{response.body.job_id}"
    assert response.body.job_id.startswith("job_")


def test_new_job_starts_queued(store: FakeJobStore) -> None:
    payload = load_fixture("create_variant_job_request")

    created = handlers.create_variant_job(
        store, payload, idempotency_key="idem-4", request_id="req-10"
    )

    assert created.body.status == JobStatus.QUEUED
    assert created.body.candidate_id is None


def test_job_lifecycle_reaches_succeeded_via_fake_worker_simulation(
    store: FakeJobStore,
) -> None:
    payload = load_fixture("create_variant_job_request")
    created = handlers.create_variant_job(
        store, payload, idempotency_key="idem-4b", request_id="req-10b"
    )

    # A1 has no real worker (that is A3 scope): `run_fake_job` stands in for
    # what a worker will eventually do, so the queued -> running -> succeeded
    # contract shape can be exercised end to end without one.
    store.run_fake_job(created.body.job_id)
    fetched = handlers.get_job(store, created.body.job_id, request_id="req-11")

    assert fetched.body.status == JobStatus.SUCCEEDED
    assert fetched.body.candidate_id is not None


def test_job_lifecycle_can_reach_failed(store: FakeJobStore) -> None:
    payload = load_fixture("create_variant_job_request")
    created = handlers.create_variant_job(
        store, payload, idempotency_key="idem-4c", request_id="req-10c"
    )

    store.run_fake_job(created.body.job_id, outcome="failed")
    fetched = handlers.get_job(store, created.body.job_id, request_id="req-11b")

    assert fetched.body.status == JobStatus.FAILED
    assert fetched.body.candidate_id is None
    assert fetched.body.failure is not None
    assert fetched.body.failure.code == "fake_adapter_failure"


def test_cancel_queued_job_succeeds(store: FakeJobStore) -> None:
    payload = load_fixture("create_variant_job_request")
    created = handlers.create_variant_job(
        store, payload, idempotency_key="idem-cancel-queued", request_id="req-10d"
    )

    response = handlers.cancel_job(store, created.body.job_id, request_id="req-10e")

    assert response.status_code == 200
    assert response.body.status == JobStatus.CANCELLED


def test_get_job_unknown_id_returns_404(store: FakeJobStore) -> None:
    with pytest.raises(ApiError) as exc_info:
        handlers.get_job(store, "job_999999", request_id="req-12")

    assert exc_info.value.status_code == 404


def test_idempotent_replay_returns_original_job(store: FakeJobStore) -> None:
    payload = load_fixture("create_variant_job_request")

    first = handlers.create_variant_job(
        store, payload, idempotency_key="idem-shared", request_id="req-13"
    )
    second = handlers.create_variant_job(
        store, payload, idempotency_key="idem-shared", request_id="req-14"
    )

    assert first.body.job_id == second.body.job_id


def test_idempotency_key_reused_with_changed_payload_returns_409(
    store: FakeJobStore,
) -> None:
    payload = load_fixture("create_variant_job_request")
    handlers.create_variant_job(
        store, payload, idempotency_key="idem-changed", request_id="req-15"
    )
    changed_payload = dict(payload, target_colour="#FFFFFF")

    with pytest.raises(ApiError) as exc_info:
        handlers.create_variant_job(
            store, changed_payload, idempotency_key="idem-changed", request_id="req-16"
        )

    assert exc_info.value.status_code == 409
    assert exc_info.value.body.code == "idempotency_conflict"


def test_cancel_succeeded_job_is_rejected_with_409(store: FakeJobStore) -> None:
    payload = load_fixture("create_variant_job_request")
    created = handlers.create_variant_job(
        store, payload, idempotency_key="idem-cancel", request_id="req-17"
    )
    store.run_fake_job(created.body.job_id)

    with pytest.raises(ApiError) as exc_info:
        handlers.cancel_job(store, created.body.job_id, request_id="req-18")

    assert exc_info.value.status_code == 409
    assert exc_info.value.body.code == "invalid_state_transition"


def test_cancel_unknown_job_returns_404(store: FakeJobStore) -> None:
    with pytest.raises(ApiError) as exc_info:
        handlers.cancel_job(store, "job_999999", request_id="req-19")

    assert exc_info.value.status_code == 404


def test_review_approves_candidate_with_matching_revision(
    store: FakeJobStore,
) -> None:
    job_payload = load_fixture("create_variant_job_request")
    created = handlers.create_variant_job(
        store, job_payload, idempotency_key="idem-review", request_id="req-20"
    )
    store.run_fake_job(created.body.job_id)
    candidate_id = handlers.get_job(
        store, created.body.job_id, request_id="req-20b"
    ).body.candidate_id
    review_payload = load_fixture("create_review_request")

    response = handlers.create_review(
        store, candidate_id, review_payload, request_id="req-21"
    )

    assert response.status_code == 201
    assert response.body.decision == "approved"
    candidate = store.candidates[candidate_id]
    assert candidate.variant.review_status == ReviewStatus.APPROVED
    # Approval alone never creates a purchasable variant: commercial_status
    # is a separate field and must not move just because review did.
    assert candidate.variant.commercial_status.value == "conceptual"


def test_review_with_stale_revision_returns_409(store: FakeJobStore) -> None:
    job_payload = load_fixture("create_variant_job_request")
    created = handlers.create_variant_job(
        store, job_payload, idempotency_key="idem-stale", request_id="req-22"
    )
    store.run_fake_job(created.body.job_id)
    candidate_id = handlers.get_job(
        store, created.body.job_id, request_id="req-22b"
    ).body.candidate_id
    review_payload = dict(load_fixture("create_review_request"), expected_revision=99)

    with pytest.raises(ApiError) as exc_info:
        handlers.create_review(store, candidate_id, review_payload, request_id="req-23")

    assert exc_info.value.status_code == 409
    assert exc_info.value.body.code == "revision_conflict"


def test_review_unknown_candidate_returns_404(store: FakeJobStore) -> None:
    review_payload = load_fixture("create_review_request")

    with pytest.raises(ApiError) as exc_info:
        handlers.create_review(
            store, "cand_999999", review_payload, request_id="req-24"
        )

    assert exc_info.value.status_code == 404
