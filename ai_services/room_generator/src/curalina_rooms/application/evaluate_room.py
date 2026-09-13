"""`EvaluateRoom` — produce a `RoomValidationResult` for a generated
candidate.

Fake-adapter scope: no real identity, colour, placement or architecture
check is implemented (that is G01/G02-gated work — see
`curalina_rooms.domain.validation`). This use case still runs the real
control flow — one `InstanceValidation` per expected instance, one
`ArchitectureValidation` per protected region — so the shape of evaluation
is exercised now, with every verdict honestly `NOT_EVALUATED`.
"""

from __future__ import annotations

from curalina_rooms.domain.generation_outcome import GenerationOutcome
from curalina_rooms.domain.render_plan import RenderPlan
from curalina_rooms.domain.validation import (
    ArchitectureValidation,
    InstanceValidation,
    RoomValidationResult,
    Verdict,
)

_IDENTITY_BLOCKED_ON = "G02"
_ARCHITECTURE_BLOCKED_ON = "G01"


def evaluate_room(plan: RenderPlan, outcome: GenerationOutcome) -> RoomValidationResult:
    instance_validations = tuple(
        InstanceValidation(
            instance_id=insertion.instance_id,
            expected_product_id=insertion.instance.product_id,
            present=None,
            identity_score=None,
            color_delta_e=None,
            bbox_iou=None,
            verdict=Verdict.NOT_EVALUATED,
            blocked_on=_IDENTITY_BLOCKED_ON,
        )
        for insertion in plan.insertions
    )
    architecture_validations = tuple(
        ArchitectureValidation(
            region_id=region.region_id,
            verdict=Verdict.NOT_EVALUATED,
            blocked_on=_ARCHITECTURE_BLOCKED_ON,
        )
        for region in plan.protected_regions
    )
    return RoomValidationResult(
        render_job_id=plan.render_job_id,
        instance_validations=instance_validations,
        architecture_validations=architecture_validations,
    )
