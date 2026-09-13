"""Typed request/response DTOs for the room-generator `/v1` contracts.

These models are transport-only: they describe the wire shape agreed in
`architecture/guides/03_data_contracts.md` and are consumed by
`curalina_rooms.api.service`. No domain, application or rendering logic is
implemented here — A1 fixtures and validation only. Every model forbids
unknown fields so that a malformed payload fails structurally instead of
silently passing through.
"""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, PositiveInt

SCHEMA_VERSION = "1.0"

JobStatus = Literal["queued", "running", "succeeded", "failed", "cancelled"]

# Two outcomes only, per `architecture/guides/03_data_contracts.md`
# ("`review_status` is pending/approved/rejected") and
# `ai_services/contracts/v1/schemas/review.schema.json`. A "needs changes"
# outcome is expressed as `rejected` plus `notes`; see ADR-0003.
ReviewDecision = Literal["approved", "rejected"]


class StrictModel(BaseModel):
    """Base model: unknown fields rejected, matching the error schema style."""

    model_config = ConfigDict(extra="forbid", frozen=True)


class ErrorResponse(StrictModel):
    """Canonical error shape shared across all three AI services.

    Field set and order matches
    `ai_services/contracts/v1/schemas/error.schema.json` exactly.
    """

    code: str
    message: str
    details: dict[str, Any]
    retryable: bool
    request_id: str


# --- Assets -----------------------------------------------------------------


class AssetImportRequest(StrictModel):
    """Metadata accompanying a `POST /v1/assets` import.

    The multipart file bytes themselves are out of scope for a JSON DTO;
    this model captures the ownership/size-check fields the contract guide
    requires alongside the upload.
    """

    schema_version: str
    owner_id: str
    original_filename: str
    media_type: str
    content_length: PositiveInt
    upstream_asset_id: str | None = None
    provenance: str = Field(min_length=1)


class AssetResponse(StrictModel):
    """Public view of an Asset, matching
    `ai_services/contracts/v1/schemas/asset.schema.json`.

    `storage_key` is deliberately absent: storage-adapter keys are internal
    and are never serialized (`03_data_contracts.md`, and the shared
    schema's own description). `provenance` is a string, not an object, for
    the same reason the shared schema says so — see ADR-0003.

    `width_px`/`height_px` are nullable here while the shared schema
    requires them. That is a known, recorded gap: the A1 fake does not
    decode image bytes and must not invent pixel dimensions. They become
    non-null at A2 when a real importer decodes the upload. See ADR-0003.
    """

    schema_version: str = SCHEMA_VERSION
    asset_id: str
    upstream_asset_id: str | None = None
    owner_id: str
    content_hash: str
    media_type: str
    width_px: PositiveInt | None = None
    height_px: PositiveInt | None = None
    original_filename: str
    provenance: str
    created_at: str


class AssetContentResponse(StrictModel):
    """Metadata for `GET /v1/assets/{id}/content`.

    Fixture stage: describes the authorized content reference rather than
    serving raw bytes, and never exposes a filesystem path.
    """

    schema_version: str = SCHEMA_VERSION
    asset_id: str
    content_hash: str
    media_type: str
    byte_size: PositiveInt
    content_ref: str


# --- Render jobs --------------------------------------------------------


class BundleReference(StrictModel):
    bundle_id: str
    bundle_revision: str


class ReferenceImage(StrictModel):
    asset_id: str
    role: str


class RenderInstanceRequirement(StrictModel):
    instance_id: str
    product_id: str
    variant_id: str | None = None
    quantity: PositiveInt = 1


class RenderJobRequest(StrictModel):
    schema_version: str
    bundle: BundleReference
    room_type: str
    layout_version: str
    instances: list[RenderInstanceRequirement]
    reference_images: list[ReferenceImage]
    idempotency_key: str | None = None


class RenderJobResponse(StrictModel):
    schema_version: str = SCHEMA_VERSION
    job_id: str
    status: Literal["queued"] = "queued"
    location: str
    bundle_id: str
    bundle_revision: str
    created_at: str


class JobResult(StrictModel):
    candidate_id: str | None = None
    outcome_counts: dict[str, int] | None = None


class JobStatusResponse(StrictModel):
    schema_version: str = SCHEMA_VERSION
    job_id: str
    status: JobStatus
    attempt_count: int
    result: JobResult | None = None
    error: ErrorResponse | None = None


class JobCancelResponse(StrictModel):
    schema_version: str = SCHEMA_VERSION
    job_id: str
    status: Literal["cancelled"] = "cancelled"
    cooperative: bool = True
    note: str = (
        "Cancellation is cooperative; a running inference step is not "
        "guaranteed to be interrupted."
    )


# --- Candidate reviews -------------------------------------------------------


class CandidateReviewRequest(StrictModel):
    schema_version: str
    reviewer_id: str
    decision: ReviewDecision
    expected_revision: int
    notes: str | None = None


class CandidateReviewResponse(StrictModel):
    """Matches `ai_services/contracts/v1/schemas/review.schema.json`:
    `revision` (not `review_version`), `created_at` (not `reviewed_at`),
    and `reviewer_id` carried through. See ADR-0003."""

    schema_version: str = SCHEMA_VERSION
    review_id: str
    candidate_id: str
    reviewer_id: str
    decision: ReviewDecision
    revision: int
    created_at: str
