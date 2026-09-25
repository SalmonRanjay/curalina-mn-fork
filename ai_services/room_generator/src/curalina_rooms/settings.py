from pathlib import Path
from typing import Literal

from pydantic import Field, PositiveInt, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(frozen=True, env_prefix="")

    curalina_env: str = Field(default="local", alias="CURALINA_ENV")
    curalina_data_dir: Path = Field(default=Path("data"), alias="CURALINA_DATA_DIR")
    curalina_database_url: str = Field(
        default="sqlite:///data/curalina_rooms.sqlite3",
        alias="CURALINA_DATABASE_URL",
    )
    curalina_model_cache: Path = Field(
        default=Path("data/model_cache"),
        alias="CURALINA_MODEL_CACHE",
    )
    curalina_device: str = Field(default="cpu", alias="CURALINA_DEVICE")
    curalina_model_revision: str = Field(
        default="fake-a0",
        alias="CURALINA_MODEL_REVISION",
    )
    curalina_max_image_pixels: PositiveInt = Field(
        default=16_777_216,
        alias="CURALINA_MAX_IMAGE_PIXELS",
    )
    # Job lease length. Must exceed `curalina_render_timeout_seconds` (CPU
    # Stable Diffusion renders take many minutes); the worker also renews the
    # lease with a heartbeat while a render is in flight.
    curalina_job_timeout_seconds: PositiveInt = Field(
        default=1800,
        alias="CURALINA_JOB_TIMEOUT_SECONDS",
    )
    # Renderer backend: "http" calls the external renderer services; "fake"
    # is a deterministic in-process backend for CI. It is never chosen
    # implicitly.
    curalina_render_backend: Literal["http", "fake"] = Field(
        default="http", alias="CURALINA_RENDER_BACKEND"
    )
    curalina_room_renderer: Literal["sd15", "composite"] = Field(
        default="sd15", alias="CURALINA_ROOM_RENDERER"
    )
    curalina_renderer_sd15_url: str = Field(
        default="http://sd15_renderer:8104", alias="CURALINA_RENDERER_SD15_URL"
    )
    curalina_renderer_composite_url: str = Field(
        default="http://composite_renderer:8105",
        alias="CURALINA_RENDERER_COMPOSITE_URL",
    )
    curalina_render_timeout_seconds: PositiveInt = Field(
        default=1500, alias="CURALINA_RENDER_TIMEOUT_SECONDS"
    )
    curalina_render_width: PositiveInt = Field(
        default=512, alias="CURALINA_RENDER_WIDTH"
    )
    curalina_render_height: PositiveInt = Field(
        default=512, alias="CURALINA_RENDER_HEIGHT"
    )
    service_host: str = "127.0.0.1"
    service_port: int = 8103

    @model_validator(mode="after")
    def _lease_must_outlast_render(self) -> "Settings":
        if self.curalina_job_timeout_seconds <= self.curalina_render_timeout_seconds:
            raise ValueError(
                "CURALINA_JOB_TIMEOUT_SECONDS must exceed "
                "CURALINA_RENDER_TIMEOUT_SECONDS so a slow render is not "
                "re-leased and run twice"
            )
        return self
