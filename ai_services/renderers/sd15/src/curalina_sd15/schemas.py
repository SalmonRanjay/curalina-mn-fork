"""Wire contract shared with the rooms worker (schema_version 1.0)."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

LABEL = (
    "Concept preview - AI-generated room in your chosen style. "
    "Not your room; catalogue products are not shown."
)
RENDERER_NAME = "sd15"


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
    width: int = Field(ge=256, le=1024)
    height: int = Field(ge=256, le=1024)
    seed: int | None = Field(default=None, ge=0, le=2**63 - 1)
    brief: Brief

    @field_validator("width", "height")
    @classmethod
    def _multiple_of_8(cls, v: int) -> int:
        if v % 8:
            raise ValueError("must be a multiple of 8")
        return v


class ErrorBody(BaseModel):
    code: str
    message: str
    retryable: bool
