"""Wire contract shared with the rooms worker (schema_version 1.0)."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

LABEL = (
    "Concept preview - illustrative room with real catalogue pieces. "
    "Not your room; pieces are not a recommendation."
)
RENDERER_NAME = "composite"
MODEL_ID = "composite-pillow-v1"


class Brief(BaseModel):
    model_config = ConfigDict(extra="ignore")

    room_type: str
    style: str
    atmosphere: str
    pattern: str | None = None


class RenderRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")

    schema_version: Literal["1.0"]
    prompt: str = Field(min_length=1)
    negative_prompt: str | None = None
    width: int = Field(ge=256, le=2048)
    height: int = Field(ge=256, le=2048)
    seed: int | None = Field(default=None, ge=0, le=2**63 - 1)
    brief: Brief


class ErrorBody(BaseModel):
    code: str
    message: str
    retryable: bool
