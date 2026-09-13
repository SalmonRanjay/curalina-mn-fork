from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(frozen=True, env_prefix="")

    curalina_env: str = Field(default="local", alias="CURALINA_ENV")
    curalina_data_dir: Path = Field(
        default=Path("data"),
        alias="CURALINA_DATA_DIR",
    )
    curalina_database_url: str = Field(
        default="sqlite:///data/curalina_recommendation.sqlite3",
        alias="CURALINA_DATABASE_URL",
    )
    service_host: str = "127.0.0.1"
    service_port: int = 8101
