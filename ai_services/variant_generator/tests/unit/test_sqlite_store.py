from __future__ import annotations

import base64
from pathlib import Path

import pytest

from curalina_variants.api.errors import ApiError
from curalina_variants.api.fixtures import load_fixture
from curalina_variants.api.schemas import (
    CreateAssetRequest,
    CreateMaskRequest,
    CreateReviewRequest,
    CreateVariantJobRequest,
    JobStatus,
    ReviewStatus,
)
from curalina_variants.api.sqlite_store import LeaseConflictError, SQLiteJobStore


def _store(tmp_path: Path) -> SQLiteJobStore:
    store = SQLiteJobStore(tmp_path / "variants.sqlite3")
    store.initialize()
    # Seed the default mask that test fixtures expect (only if not already present)
    try:
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
    except Exception:
        # If mask already exists (e.g., in persistence tests that reuse the database),
        # that's fine - we're just ensuring it's there
        pass
    return store


def test_sqlite_store_persists_jobs_and_idempotency(tmp_path: Path) -> None:
    first = _store(tmp_path)
    request = CreateVariantJobRequest.model_validate(
        load_fixture("create_variant_job_request")
    )
    created, was_created = first.create_variant_job(
        request, idempotency_key="idem-sqlite", request_id="req-1"
    )

    second = _store(tmp_path)
    replayed, replay_created = second.create_variant_job(
        request, idempotency_key="idem-sqlite", request_id="req-2"
    )

    assert was_created is True
    assert replay_created is False
    assert replayed.job_id == created.job_id
    assert second.get_job(created.job_id, request_id="req-3").status == JobStatus.QUEUED


def test_sqlite_store_persists_asset_content(tmp_path: Path) -> None:
    store = _store(tmp_path)
    request = CreateAssetRequest.model_validate(
        {
            "schema_version": "1.0",
            "owner_id": "owner-1",
            "original_filename": "asset.png",
            "media_type": "image/png",
            "content_bytes": b"asset-bytes",
        }
    )

    created = store.create_asset(request, request_id="req-asset")
    restored = _store(tmp_path).get_asset_content(
        created.asset_id, request_id="req-read"
    )

    assert created.content_hash.startswith("sha256:")
    assert restored.media_type == "image/png"
    assert restored.content_bytes == b"asset-bytes"


def test_sqlite_store_rejects_changed_idempotency_payload(tmp_path: Path) -> None:
    store = _store(tmp_path)
    request = CreateVariantJobRequest.model_validate(
        load_fixture("create_variant_job_request")
    )
    store.create_variant_job(request, idempotency_key="idem", request_id="req-1")
    changed = request.model_copy(update={"target_colour": "#FFFFFF"})

    with pytest.raises(ApiError):
        store.create_variant_job(changed, idempotency_key="idem", request_id="req-2")


def test_sqlite_store_lease_and_complete_creates_candidate(tmp_path: Path) -> None:
    store = _store(tmp_path)
    request = CreateVariantJobRequest.model_validate(
        load_fixture("create_variant_job_request")
    )
    created, _ = store.create_variant_job(
        request, idempotency_key="idem-worker", request_id="req-1"
    )

    leased = store.lease_next_job(worker_id="worker-1", lease_seconds=60)
    assert leased is not None
    assert leased.job_id == created.job_id
    assert leased.status == JobStatus.RUNNING

    completed = store.complete_leased_job(created.job_id, worker_id="worker-1")

    assert completed.status == JobStatus.SUCCEEDED
    assert completed.candidate_id is not None
    assert store.get_job(created.job_id, request_id="req-2").candidate_id == (
        completed.candidate_id
    )


def test_sqlite_store_cancel_queued_job(tmp_path: Path) -> None:
    store = _store(tmp_path)
    request = CreateVariantJobRequest.model_validate(
        load_fixture("create_variant_job_request")
    )
    created, _ = store.create_variant_job(
        request, idempotency_key="idem-cancel", request_id="req-1"
    )

    cancelled = store.cancel_job(created.job_id, request_id="req-cancel")

    assert cancelled.status == JobStatus.CANCELLED


def test_sqlite_store_failed_completion_records_error(tmp_path: Path) -> None:
    store = _store(tmp_path)
    request = CreateVariantJobRequest.model_validate(
        load_fixture("create_variant_job_request")
    )
    created, _ = store.create_variant_job(
        request, idempotency_key="idem-fail", request_id="req-1"
    )
    leased = store.lease_next_job(worker_id="worker-1", lease_seconds=60)
    assert leased is not None

    failed = store.complete_leased_job(
        created.job_id, worker_id="worker-1", outcome="failed"
    )

    assert failed.status == JobStatus.FAILED
    assert failed.failure is not None
    assert failed.failure.code == "fake_adapter_failure"


def test_sqlite_store_rejects_wrong_worker_completion(tmp_path: Path) -> None:
    store = _store(tmp_path)
    request = CreateVariantJobRequest.model_validate(
        load_fixture("create_variant_job_request")
    )
    created, _ = store.create_variant_job(
        request, idempotency_key="idem-lease", request_id="req-1"
    )
    leased = store.lease_next_job(worker_id="worker-1", lease_seconds=60)
    assert leased is not None

    with pytest.raises(LeaseConflictError):
        store.complete_leased_job(created.job_id, worker_id="worker-2")


def test_sqlite_store_review_updates_candidate_revision(tmp_path: Path) -> None:
    store = _store(tmp_path)
    request = CreateVariantJobRequest.model_validate(
        load_fixture("create_variant_job_request")
    )
    created, _ = store.create_variant_job(
        request, idempotency_key="idem-review", request_id="req-1"
    )
    leased = store.lease_next_job(worker_id="worker-1", lease_seconds=60)
    assert leased is not None
    completed = store.complete_leased_job(created.job_id, worker_id="worker-1")
    assert completed.candidate_id is not None
    review_request = CreateReviewRequest.model_validate(
        load_fixture("create_review_request")
    )

    review = store.create_review(
        completed.candidate_id, review_request, request_id="req-review"
    )

    assert review.revision == 2
    candidate = store.get_candidate(completed.candidate_id, request_id="req-candidate")
    assert candidate.variant.review_status == ReviewStatus.APPROVED
