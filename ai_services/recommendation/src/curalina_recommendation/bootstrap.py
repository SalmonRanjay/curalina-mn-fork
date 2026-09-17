from curalina_recommendation.settings import Settings


def build_settings() -> Settings:
    return Settings()


def main() -> int:
    import uvicorn

    from curalina_recommendation.api.routes import create_app

    settings = build_settings()
    uvicorn.run(create_app(), host=settings.service_host, port=settings.service_port)
    return 0


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
