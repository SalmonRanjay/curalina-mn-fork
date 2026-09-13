"""Room-generation application use cases.

A2 fake-adapter scope, following `architecture/guides/06_room_generation.md`'s
agent build order: validate the request, build a render plan, run a
bounded generation attempt through a `GroundedGenerationAdapter`, evaluate
the result, and record a candidate review.
"""

from curalina_rooms.application.evaluate_room import evaluate_room
from curalina_rooms.application.generate_room import GenerateRoomResult, generate_room
from curalina_rooms.application.plan_rendering import build_render_plan
from curalina_rooms.application.review_room import (
    ReviewVersionConflictError,
    review_room,
)
from curalina_rooms.application.validate_render_request import (
    ValidatedRenderRequest,
    validate_render_request,
)

__all__ = [
    "GenerateRoomResult",
    "ReviewVersionConflictError",
    "ValidatedRenderRequest",
    "build_render_plan",
    "evaluate_room",
    "generate_room",
    "review_room",
    "validate_render_request",
]
