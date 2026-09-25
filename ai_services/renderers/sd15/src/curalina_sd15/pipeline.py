"""Pipeline port plus the one real factory (the only torch/diffusers import)."""

from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Any, Protocol

from PIL import Image


@dataclass(frozen=True)
class Settings:
    model_id: str = "stable-diffusion-v1-5/stable-diffusion-v1-5"
    steps: int = 20
    guidance: float = 7.5

    @classmethod
    def from_env(cls, env: dict[str, str] | None = None) -> Settings:
        e = os.environ if env is None else env
        d = cls()
        return cls(
            model_id=e.get("SD15_MODEL_ID", d.model_id),
            steps=int(e.get("SD15_STEPS", d.steps)),
            guidance=float(e.get("SD15_GUIDANCE", d.guidance)),
        )


class Pipeline(Protocol):
    def generate(
        self,
        prompt: str,
        negative_prompt: str | None,
        width: int,
        height: int,
        seed: int | None,
    ) -> Image.Image: ...


class PipelineFactory(Protocol):
    def build(self, settings: Settings) -> Pipeline: ...


class _DiffusersPipeline:
    def __init__(
        self,
        pipe: Any,  # noqa: ANN401  diffusers pipeline, untyped
        device: str,
        settings: Settings,
    ) -> None:
        self._pipe = pipe
        self._device = device
        self._settings = settings

    def generate(
        self,
        prompt: str,
        negative_prompt: str | None,
        width: int,
        height: int,
        seed: int | None,
    ) -> Image.Image:
        import torch  # type: ignore[import-not-found,unused-ignore]

        generator = None
        if seed is not None:
            generator = torch.Generator(device="cpu").manual_seed(seed)
        result = self._pipe(
            prompt=prompt,
            negative_prompt=negative_prompt,
            width=width,
            height=height,
            num_inference_steps=self._settings.steps,
            guidance_scale=self._settings.guidance,
            generator=generator,
        )
        image: Image.Image = result.images[0]
        return image


class DiffusersPipelineFactory:
    """Real factory; imports torch/diffusers lazily (package imports without them)."""

    def build(self, settings: Settings) -> Pipeline:
        import torch  # type: ignore[import-not-found,unused-ignore]
        from diffusers import (  # type: ignore[import-not-found,unused-ignore]
            DPMSolverMultistepScheduler,
            StableDiffusionPipeline,
        )

        torch.set_num_threads(os.cpu_count() or 1)
        device = "cuda" if torch.cuda.is_available() else "cpu"
        dtype = torch.float16 if device == "cuda" else torch.float32
        pipe = StableDiffusionPipeline.from_pretrained(
            settings.model_id,
            torch_dtype=dtype,
            # Safety checker disabled: this is a local developer/demo backend
            # rendering interior scenes from fixed prompts; the checker adds a
            # second model download and false-positive black images on rooms.
            safety_checker=None,
            requires_safety_checker=False,
        )
        pipe.scheduler = DPMSolverMultistepScheduler.from_config(pipe.scheduler.config)
        pipe.enable_attention_slicing()
        pipe = pipe.to(device)
        return _DiffusersPipeline(pipe, device, settings)
