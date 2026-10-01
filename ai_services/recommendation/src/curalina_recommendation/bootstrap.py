from curalina_recommendation.settings import Settings


def build_settings() -> Settings:
    return Settings()


def main() -> int:
    import uvicorn

    from curalina_recommendation.api.routes import create_app
    from curalina_recommendation.db.migrator import run_migrations

    settings = build_settings()
    run_migrations(
        settings.curalina_database_url, schema=settings.curalina_database_schema
    )
    uvicorn.run(create_app(), host=settings.service_host, port=settings.service_port)
    return 0


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
