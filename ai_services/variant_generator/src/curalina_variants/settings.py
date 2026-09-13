from pathlib import Path

from pydantic import Field, PositiveInt
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(frozen=True, env_prefix="")

    curalina_env: str = Field(default="local", alias="CURALINA_ENV")
    curalina_data_dir: Path = Field(default=Path("data"), alias="CURALINA_DATA_DIR")
    curalina_database_url: str = Field(
        default="sqlite:///data/curalina_variants.sqlite3",
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
    curalina_job_timeout_seconds: PositiveInt = Field(
        default=300,
        alias="CURALINA_JOB_TIMEOUT_SECONDS",
    )
    service_host: str = "127.0.0.1"
    service_port: int = 8102
