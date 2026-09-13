from dataclasses import dataclass

from curalina_design_rules.types.primitives import StyleCode


@dataclass(frozen=True)
class DesignProfile:
    profile_id: str
    style: StyleCode
    tonality: str
    room_intent: str
