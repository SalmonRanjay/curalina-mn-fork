"""Pure room-generation domain records and functions.

A2 fake-adapter scope: render-job state (three separate fields — job
status, candidate review, commercial availability), the render plan that
wraps `curalina_design_rules`'s `StyledRoom`, room-prep types (blocked on
G01/OQ-010), and post-render validation result types (blocked on
G01/G02) — see each module's docstring for its specific gate.
"""

from curalina_rooms.domain.errors import (
    DuplicateInstanceIdError,
    MaxAttemptsExceededError,
    MismatchedVariantParentError,
    MissingReferenceAssetError,
    ProtectedOpeningOverlapError,
    RejectedVariantImportError,
    RenderPlanValidationError,
    StaleBundleRevisionError,
    UnsupportedSchemaVersionError,
)
from curalina_rooms.domain.generation_outcome import GenerationOutcome
from curalina_rooms.domain.geometry import BoundingBox
from curalina_rooms.domain.render_job import (
    CandidateReviewStatus,
    CommercialAvailability,
    JobStatus,
    RenderJobState,
)
from curalina_rooms.domain.render_plan import PlannedInsertion, RenderPlan
from curalina_rooms.domain.render_request import (
    ReferenceAssetInfo,
    RenderRequest,
    RenderRequestInstance,
    VariantReviewStatus,
    VisibilityExpectation,
)
from curalina_rooms.domain.room_prep import (
    ProtectedRegion,
    ProtectedRegionKind,
    RoomPrepRequest,
    RoomPrepResult,
    RoomPrepSource,
)
from curalina_rooms.domain.validation import (
    ArchitectureValidation,
    InstanceValidation,
    RoomValidationResult,
    Verdict,
)

__all__ = [
    "ArchitectureValidation",
    "BoundingBox",
    "CandidateReviewStatus",
    "CommercialAvailability",
    "DuplicateInstanceIdError",
    "GenerationOutcome",
    "InstanceValidation",
    "JobStatus",
    "MaxAttemptsExceededError",
    "MismatchedVariantParentError",
    "MissingReferenceAssetError",
    "PlannedInsertion",
    "ProtectedOpeningOverlapError",
    "ProtectedRegion",
    "ProtectedRegionKind",
    "ReferenceAssetInfo",
    "RejectedVariantImportError",
    "RenderJobState",
    "RenderPlan",
    "RenderPlanValidationError",
    "RenderRequest",
    "RenderRequestInstance",
    "RoomPrepRequest",
    "RoomPrepResult",
    "RoomPrepSource",
    "RoomValidationResult",
    "StaleBundleRevisionError",
    "UnsupportedSchemaVersionError",
    "VariantReviewStatus",
    "Verdict",
    "VisibilityExpectation",
]
