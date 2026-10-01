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
    # Consultation recommender (ADR-0025). The supplier "Programmer Handoff"
    # workbooks are read in place from this folder, never copied into the
    # repository or the image (STATUS item 35). Unset: the consultation
    # endpoint answers 503 `catalogue_not_configured` instead of guessing.
    curalina_supplier_data_dir: Path | None = Field(
        default=None,
        alias="CURALINA_SUPPLIER_DATA_DIR",
    )
    # Unset: the model artifact packaged with the service
    # (`consultation/model/`). Set: a notebook run folder with the same files.
    curalina_recommender_model_dir: Path | None = Field(
        default=None,
        alias="CURALINA_RECOMMENDER_MODEL_DIR",
    )
    # The workbooks carry no currency column. CAD is the owner's default
    # (STATUS item 20); configurable rather than assumed.
    curalina_catalogue_currency: str = Field(
        default="CAD",
        alias="CURALINA_CATALOGUE_CURRENCY",
        pattern=r"^[A-Z]{3}$",
    )
    curalina_min_match_score: float = Field(
        default=0.5,
        alias="CURALINA_MIN_MATCH_SCORE",
        ge=0.0,
        le=1.0,
    )
    service_host: str = "127.0.0.1"
    service_port: int = 8101
