"""Typed request/response DTOs for the recommendation `/v1` HTTP surface.

These are transport-layer contracts only (per
`agentic_flow/13_recommendation_technical_design.md`'s module layout,
`api/` holds `routes.py schemas.py errors.py`). They intentionally do not
import from `domain/`: A1 freezes wire shapes before any business logic
exists, and `domain/` stays empty until A2. Field names and units follow
`architecture/guides/03_data_contracts.md` ("Core records" and "Contract
rules"): money as integer minor units, dimensions and IDs as explicit
strings, `schema_version` on every payload, `/v1` paths.

ID prefixes (`snap_`, `rev_`) follow `ai_services/contracts/v1/id_versioning.md`.
"""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field, field_validator

SUPPORTED_SCHEMA_VERSION = "1.0"
SUPPORTED_SCHEMA_MAJOR = "1"


def _check_schema_version(value: str) -> str:
    major = value.split(".", 1)[0]
    if major != SUPPORTED_SCHEMA_MAJOR:
        raise ValueError(
            f"unsupported schema_version major {major!r}; "
            f"this service accepts major {SUPPORTED_SCHEMA_MAJOR!r} only"
        )
    return value


class SchemaVersionedRequest(BaseModel):
    """Base for every request body: carries and validates `schema_version`."""

    model_config = ConfigDict(extra="forbid")

    schema_version: str = Field(min_length=1)

    @field_validator("schema_version")
    @classmethod
    def _validate_schema_version(cls, value: str) -> str:
        return _check_schema_version(value)


class SchemaVersionedResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    schema_version: str = SUPPORTED_SCHEMA_VERSION


# --- Shared sub-shapes -------------------------------------------------


class DesignProfileIn(BaseModel):
    """Minimal `DesignProfile` slice needed by the fake endpoints.

    Mirrors `03_data_contracts.md`'s `DesignProfile` record; lifestyle
    fields are typed, not a free-text blob.
    """

    model_config = ConfigDict(extra="forbid")

    room_type: str = Field(min_length=1)
    style: str = Field(min_length=1)
    atmosphere: str = Field(min_length=1)
    categories: list[str] = Field(min_length=1)
    furniture_budget_minor_units: int = Field(ge=0)
    currency: str = Field(min_length=3, max_length=3)


class BundleLineItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    product_id: str = Field(min_length=1)
    category: str = Field(min_length=1)
    quantity: int = Field(ge=1)
    unit_price_minor_units: int = Field(ge=0)
    currency: str = Field(min_length=3, max_length=3)


class BundleViolation(BaseModel):
    model_config = ConfigDict(extra="forbid")

    code: str = Field(min_length=1)
    message: str = Field(min_length=1)


# --- POST /v1/catalogue/imports -----------------------------------------


class CatalogueImportRequest(SchemaVersionedRequest):
    source_uri: str = Field(min_length=1)
    supplier_id: str = Field(min_length=1)


class CatalogueImportReport(BaseModel):
    model_config = ConfigDict(extra="forbid")

    products_seen: int = Field(ge=0)
    products_imported: int = Field(ge=0)
    products_rejected: int = Field(ge=0)
    rejected_reasons: list[str] = Field(default_factory=list)


class CatalogueImportResponse(SchemaVersionedResponse):
    snapshot_id: str = Field(min_length=1)
    report: CatalogueImportReport


# --- POST /v1/recommendations -------------------------------------------


class RecommendationRequest(SchemaVersionedRequest):
    catalogue_snapshot_id: str = Field(min_length=1)
    profile: DesignProfileIn


class RankedCandidate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    product_id: str = Field(min_length=1)
    category: str = Field(min_length=1)
    score: float = Field(ge=0.0, le=1.0)
    reasons: list[str] = Field(default_factory=list)


class RecommendationResponse(SchemaVersionedResponse):
    catalogue_snapshot_id: str = Field(min_length=1)
    candidates: list[RankedCandidate] = Field(default_factory=list)


# --- POST /v1/bundles -----------------------------------------------------


class BundleRequest(SchemaVersionedRequest):
    catalogue_snapshot_id: str = Field(min_length=1)
    rules_version: str = Field(min_length=1)
    profile: DesignProfileIn


class BundleResponse(SchemaVersionedResponse):
    bundle_id: str = Field(min_length=1)
    revision: int = Field(ge=1)
    feasible: bool
    line_items: list[BundleLineItem] = Field(default_factory=list)
    total_minor_units: int = Field(ge=0, default=0)
    currency: str | None = None
    violations: list[BundleViolation] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)


# --- POST /v1/bundles/{bundle_id}/substitutions --------------------------


class SubstitutionRequest(SchemaVersionedRequest):
    replace_product_id: str = Field(min_length=1)
    reason: str | None = None


class SubstitutionResponse(SchemaVersionedResponse):
    original_bundle_id: str = Field(min_length=1)
    new_bundle_id: str = Field(min_length=1)
    revision: int = Field(ge=1)
    feasible: bool
    line_items: list[BundleLineItem] = Field(default_factory=list)
    violations: list[BundleViolation] = Field(default_factory=list)
