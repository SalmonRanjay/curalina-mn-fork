"""Alembic environment for the recommendation service's own Postgres database.

Configuration (database URL, target schema) is always supplied by the
caller — either the `curalina_recommendation.db.migrator` module at service
startup/test-setup, or the `-x db_url=...` CLI option when running `alembic`
by hand. There is no hardcoded fallback database to avoid silently migrating
the wrong instance.
"""

from __future__ import annotations

from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = None


def _database_url() -> str:
    x_args = context.get_x_argument(as_dictionary=True)
    url = (
        x_args.get("db_url")
        or config.get_main_option("sqlalchemy.url")
    )
    if not url:
        raise RuntimeError(
            "No database URL supplied to Alembic. Pass -x db_url=... or set "
            "sqlalchemy.url in the Alembic config before invoking migrations."
        )
    return str(url)


def _version_table_schema() -> str | None:
    x_args = context.get_x_argument(as_dictionary=True)
    schema = x_args.get("version_table_schema") or config.get_main_option(
        "version_table_schema"
    )
    return str(schema) if schema else None


def run_migrations_offline() -> None:
    url = _database_url()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        version_table_schema=_version_table_schema(),
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    configuration = config.get_section(config.config_ini_section) or {}
    configuration["sqlalchemy.url"] = _database_url()
    connectable = engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            version_table_schema=_version_table_schema(),
        )

        with context.begin_transaction():
            context.run_migrations()

    connectable.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
