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
        default="postgresql://curalina:curalina_dev_password@localhost:5432/curalina_recommendation",
        alias="CURALINA_DATABASE_URL",
    )
    # Postgres schema within curalina_database_url's database. Defaults to
    # "public" in production; tests override this per-test-function to get
    # SQLite-tmp-file-equivalent isolation inside one shared test database.
    curalina_database_schema: str = Field(
        default="public",
        alias="CURALINA_DATABASE_SCHEMA",
    )
    service_host: str = "127.0.0.1"
    service_port: int = 8101
