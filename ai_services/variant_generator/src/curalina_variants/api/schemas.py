"""Typed DTOs for the variant-generator `/v1` contract.

These model `VisualVariant`, `Asset` and `Mask` records plus the job-lifecycle
request/response bodies described in `architecture/guides/03_data_contracts.md`.
Nothing here performs image I/O, mask math or model inference — A1 is
contract-only. Durable persistence and a real worker arrive in A3; until then
`store.FakeJobStore` backs these DTOs with in-memory fixture-shaped data.

Conventions enforced here (per `ai_services/contracts/v1/id_versioning.md`):
- HTTP paths use `/v1`; payloads carry `schema_version` (only major `1` is
  supported for this packet, spelled `"1.0"`).
- Asset ids are prefixed `asset_`, job ids `job_`, candidate ids `cand_`.
- Content hashes are lowercase SHA-256 hex prefixed `sha256:`.
"""

from __future__ import annotations

import base64
from datetime import datetime
from enum import StrEnum
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

SUPPORTED_SCHEMA_MAJOR = 1
SUPPORTED_SCHEMA_VERSION = "1.0"


class ReviewStatus(StrEnum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class CommercialStatus(StrEnum):
    CONCEPTUAL = "conceptual"
    CUSTOM_ORDER = "custom_order"
    SUPPLIER_CONFIRMED = "supplier_confirmed"


class JobStatus(StrEnum):
    QUEUED = "queued"
    RUNNING = "running"
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    CANCELLED = "cancelled"


TERMINAL_JOB_STATUSES = frozenset(
    {JobStatus.SUCCEEDED, JobStatus.FAILED, JobStatus.CANCELLED}
)

# `queued -> running -> succeeded|failed|cancelled`, plus a cooperative
# cancellation edge from either non-terminal state, per `03_data_contracts.md`
# "Durable job behaviour".
ALLOWED_JOB_TRANSITIONS: dict[JobStatus, frozenset[JobStatus]] = {
    JobStatus.QUEUED: frozenset({JobStatus.RUNNING, JobStatus.CANCELLED}),
    JobStatus.RUNNING: frozenset(
        {JobStatus.SUCCEEDED, JobStatus.FAILED, JobStatus.CANCELLED}
    ),
    JobStatus.SUCCEEDED: frozenset(),
    JobStatus.FAILED: frozenset(),
    JobStatus.CANCELLED: frozenset(),
}


class VersionedModel(BaseModel):
    """Base for request bodies: every payload declares its schema_version."""

    model_config = ConfigDict(frozen=True, extra="forbid")

    schema_version: str = Field(default=SUPPORTED_SCHEMA_VERSION)


class AssetRecord(BaseModel):
    """Public view of an `Asset` record. Storage keys are internal and never
    serialized here, per `03_data_contracts.md`."""

    model_config = ConfigDict(frozen=True, extra="forbid")

    schema_version: str = SUPPORTED_SCHEMA_VERSION
    asset_id: str
    upstream_asset_id: str | None = None
    content_hash: str
    media_type: str
    width_px: int = Field(gt=0)
    height_px: int = Field(gt=0)
    owner_id: str
    provenance: str
    original_filename: str
    created_at: datetime


class CreateAssetRequest(VersionedModel):
    """Modeled multipart upload: bytes are represented as the decoded field
    set a contract test can construct deterministically, without a real
    ASGI/multipart stack (deferred to A3)."""

    owner_id: str = Field(min_length=1)
    original_filename: str = Field(min_length=1)
    media_type: Literal["image/png", "image/jpeg", "image/webp"]
    content_bytes: bytes


class ProtectedSubregion(BaseModel):
    """A rectangular protected subregion in source-image pixel coordinates.

    Corresponds to `domain/mask_spec.py:Region`. Editable/protected convention:
    pixels inside this region must not be modified by recolouring."""

    model_config = ConfigDict(frozen=True, extra="forbid")

    x_px: int = Field(ge=0)
    y_px: int = Field(ge=0)
    width_px: int = Field(gt=0)
    height_px: int = Field(gt=0)


class MaskRecord(BaseModel):
    """Editable/protected convention: 1 == editable, 0 == protected, per
    `03_data_contracts.md` and
    `agentic_flow/15_variant_generation_technical_design.md`."""

    model_config = ConfigDict(frozen=True, extra="forbid")

    schema_version: str = SUPPORTED_SCHEMA_VERSION
    mask_id: str
    source_asset_id: str
    width_px: int = Field(gt=0)
    height_px: int = Field(gt=0)
    editable_mask_b64: str  # base64-encoded bytes: 1 = editable, 0 = protected
    protected_subregions: list[ProtectedSubregion] = Field(default_factory=list)
    feather_band_px: int = Field(ge=0)
    human_corrected: bool = False
    revision: int = Field(ge=1)
    created_at: datetime | None = None


class CreateMaskRequest(VersionedModel):
    """Request to ingest a human-authored mask.

    The editable_mask must be base64-encoded bytes where each byte is either
    0 (protected) or 1 (editable), in row-major order matching width_px * height_px.

    Per `agentic_flow/15_variant_generation_technical_design.md`, masks are
    human-authored per-region artifacts, never auto-generated."""

    mask_id: str = Field(min_length=1)
    source_asset_id: str = Field(min_length=1)
    width_px: int = Field(gt=0)
    height_px: int = Field(gt=0)
    editable_mask_b64: str = Field(min_length=1)
    protected_subregions: list[ProtectedSubregion] = Field(default_factory=list)
    feather_band_px: int = Field(ge=0, default=3)
    human_corrected: bool = Field(default=False)
    revision: int = Field(ge=1, default=1)

    @field_validator("editable_mask_b64")
    @classmethod
    def validate_mask_bytes(cls, v: str) -> str:
        """Ensure the base64 string decodes to valid byte values."""
        try:
            decoded = base64.b64decode(v)
        except Exception as exc:
            raise ValueError("editable_mask_b64 must be valid base64") from exc

        # Check that all bytes are 0 or 1
        if any(byte not in (0, 1) for byte in decoded):
            raise ValueError(
                "editable_mask_b64 must decode to bytes with only 0 "
                "(protected) or 1 (editable)"
            )

        return v


class VisualVariant(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")

    schema_version: str = SUPPORTED_SCHEMA_VERSION
    variant_id: str
    parent_product_id: str
    source_asset_id: str
    output_asset_id: str | None = None
    target_colour: str
    mask_id: str
    review_status: ReviewStatus = ReviewStatus.PENDING
    commercial_status: CommercialStatus = CommercialStatus.CONCEPTUAL
    supplier_variant_sku: str | None = None
    generation_manifest: dict[str, Any] = Field(default_factory=dict)


class CreateVariantJobRequest(VersionedModel):
    parent_product_id: str = Field(min_length=1)
    source_asset_id: str = Field(min_length=1)
    mask_id: str = Field(min_length=1)
    target_colour: str = Field(min_length=1)
    owner_id: str = Field(min_length=1)


class ErrorSummary(BaseModel):
    """Minimal failure record embedded on a failed job. Distinct from the
    transport `ErrorBody` returned to the caller for the request that reads
    the job."""

    model_config = ConfigDict(frozen=True, extra="forbid")

    code: str
    message: str


class JobRecord(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")

    schema_version: str = SUPPORTED_SCHEMA_VERSION
    job_id: str
    status: JobStatus
    owner_id: str
    idempotency_key: str
    request_hash: str
    attempt_count: int = Field(ge=0)
    created_at: datetime
    updated_at: datetime
    candidate_id: str | None = None
    failure: ErrorSummary | None = None


class CandidateRecord(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")

    schema_version: str = SUPPORTED_SCHEMA_VERSION
    candidate_id: str
    variant: VisualVariant
    revision: int = Field(ge=1)


class CreateReviewRequest(VersionedModel):
    reviewer_id: str = Field(min_length=1)
    decision: Literal["approved", "rejected"]
    expected_revision: int = Field(ge=1)


class ReviewRecord(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")

    schema_version: str = SUPPORTED_SCHEMA_VERSION
    review_id: str
    candidate_id: str
    reviewer_id: str
    decision: Literal["approved", "rejected"]
    revision: int = Field(ge=1)
    created_at: datetime


class AssetContent(BaseModel):
    """Authorized bytes for `GET /v1/assets/{id}/content`. No filesystem path
    is ever exposed."""

    model_config = ConfigDict(frozen=True, extra="forbid")

    media_type: str
    content_bytes: bytes


VisualVariant.model_rebuild()
JobRecord.model_rebuild()
