from curalina_recommendation.settings import Settings


def build_settings() -> Settings:
    return Settings()


def main() -> int:
    settings = build_settings()
    print(
        "curalina_recommendation scaffold ready "
        f"on {settings.service_host}:{settings.service_port}"
    )
    return 0


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
