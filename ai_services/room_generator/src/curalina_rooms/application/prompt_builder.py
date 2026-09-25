"""Deterministic prompt construction for concept renders."""

from __future__ import annotations

from curalina_rooms.api.schemas import RenderBrief

NEGATIVE_PROMPT = "people, text, watermark, distorted furniture, low quality"


def build_prompt(brief: RenderBrief) -> str:
    """An explicit `brief.prompt` wins; otherwise the fixed template."""
    if brief.prompt is not None and brief.prompt.strip():
        return brief.prompt.strip()
    parts = [
        f"a photorealistic interior photograph of a {brief.room_type}",
        f"{brief.style} style",
        f"{brief.atmosphere} lighting and mood",
    ]
    if brief.pattern:
        parts.append(brief.pattern)
    parts.append(
        "editorial interior design photography, natural light, high detail"
    )
    return ", ".join(parts)
