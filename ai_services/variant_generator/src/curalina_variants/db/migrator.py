"""Runs the service's checked-in Alembic migrations against its own Postgres
database.

Replaces the old `CREATE TABLE IF NOT EXISTS` statements that used to live in
`PostgresJobStore.initialize()`. Migrations are explicit, versioned
files under `migrations/versions/`, re-runnable (`alembic upgrade head` is a
no-op once the target schema is current), and reviewable the same way the
TypeScript app's Drizzle migrations are.
"""

from __future__ import annotations

import re
from pathlib import Path

import psycopg
from alembic import command
from alembic.config import Config

_MIGRATIONS_DIR = Path(__file__).resolve().parents[1] / "migrations"
_VALID_SCHEMA_NAME = re.compile(r"^[a-zA-Z_][a-zA-Z0-9_]*$")


def run_migrations(database_url: str, *, schema: str = "public") -> None:
    """Upgrade `database_url`'s `schema` to the latest revision ("head").

    Creates `schema` first if it does not exist (always a no-op for the
    default "public" schema; used by test fixtures to give each test its own
    isolated schema — tables and the `alembic_version` bookkeeping table
    alike — inside one shared Postgres instance).
    """
    if not _VALID_SCHEMA_NAME.match(schema):
        raise ValueError(f"Unsafe schema name: {schema!r}")
    if not _MIGRATIONS_DIR.exists():  # pragma: no cover - packaging guard
        raise RuntimeError(f"Alembic migrations directory not found: {_MIGRATIONS_DIR}")

    _create_schema_if_missing(database_url, schema)

    config = Config(str(_MIGRATIONS_DIR / "alembic.ini"))
    config.set_main_option("script_location", str(_MIGRATIONS_DIR))
    config.set_main_option("sqlalchemy.url", _sqlalchemy_url(database_url, schema))
    config.set_main_option("version_table_schema", schema)
    command.upgrade(config, "head")


def _create_schema_if_missing(database_url: str, schema: str) -> None:
    with psycopg.connect(_psycopg_dsn(database_url), autocommit=True) as connection:
        connection.execute(f'CREATE SCHEMA IF NOT EXISTS "{schema}"')


def _psycopg_dsn(database_url: str) -> str:
    if database_url.startswith("postgresql+psycopg://"):
        return "postgresql://" + database_url.removeprefix("postgresql+psycopg://")
    return database_url


def _sqlalchemy_url(database_url: str, schema: str) -> str:
    """Point the SQLAlchemy/psycopg engine at `schema` via libpq's `options`
    connection parameter, and normalize to the psycopg (v3) driver.

    Built without `urllib.parse.urlencode` (which percent-escapes `=` to
    `%3D`) because the result is later handed to `configparser` via
    `Config.set_main_option`, and configparser's `%` is its own
    interpolation marker — a literal `%` in the stored value raises
    `ValueError: invalid interpolation syntax`.
    """
    bare = _psycopg_dsn(database_url)
    separator = "&" if "?" in bare else "?"
    rest = bare.split("://", 1)[1]
    return (
        f"postgresql+psycopg://{rest}{separator}options=-csearch_path={schema}"
    )
