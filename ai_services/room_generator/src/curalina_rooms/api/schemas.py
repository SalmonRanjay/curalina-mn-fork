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

from pydantic import BaseModel, ConfigDict, Field, PositiveInt, model_validator

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


RendererName = Literal["sd15", "composite"]

# Concept renders are ADR-0020 mode S: a synthetic scene, never measured or
# certified against a real room.
CONCEPT_PROVENANCE_MODE = "synthetic_scene"


class RenderBrief(StrictModel):
    """Additive (contract 1.x minor) brief for a text-to-image concept render.

    `renderer` may be omitted; the worker then uses `CURALINA_ROOM_RENDERER`.
    """

    renderer: RendererName | None = None
    room_type: str = Field(min_length=1)
    style: str = Field(min_length=1)
    atmosphere: str = Field(min_length=1)
    pattern: str | None = None
    prompt: str | None = None
    seed: int | None = None


class RenderJobRequest(StrictModel):
    """A bundle-grounded render request or, when `render_brief` is present,
    a concept render. Without a brief, every bundle-style field is required.
    """

    schema_version: str
    bundle: BundleReference | None = None
    room_type: str | None = None
    layout_version: str | None = None
    provenance_mode: str | None = None
    instances: list[RenderInstanceRequirement] | None = None
    reference_images: list[ReferenceImage] | None = None
    idempotency_key: str | None = None
    render_brief: RenderBrief | None = None

    @model_validator(mode="after")
    def _require_bundle_fields_without_brief(self) -> RenderJobRequest:
        if self.render_brief is None:
            missing = [
                name
                for name in (
                    "bundle",
                    "room_type",
                    "layout_version",
                    "provenance_mode",
                    "instances",
                    "reference_images",
                )
                if getattr(self, name) is None
            ]
            if missing:
                raise ValueError(
                    "without render_brief these fields are required: "
                    + ", ".join(missing)
                )
        return self


class RenderJobResponse(StrictModel):
    schema_version: str = SCHEMA_VERSION
    job_id: str
    status: Literal["queued"] = "queued"
    location: str
    bundle_id: str | None = None
    bundle_revision: str | None = None
    created_at: str


class JobResult(StrictModel):
    """Job outcome. Legacy jobs set `candidate_id`/`outcome_counts` only and
    have no image. Concept renders set `output_asset_id` and the fields
    that describe how it was made; `GET /v1/assets/{output_asset_id}/content`
    serves the PNG.
    """

    candidate_id: str | None = None
    outcome_counts: dict[str, int] | None = None
    output_asset_id: str | None = None
    renderer: str | None = None
    model_id: str | None = None
    label: str | None = None
    elapsed_ms: int | None = None
    provenance_mode: str | None = None
    measurement_certified: bool | None = None


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
