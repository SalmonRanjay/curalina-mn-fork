from curalina_variants.settings import Settings


def build_settings() -> Settings:
    return Settings()


def main(process: str = "api") -> int:
    settings = build_settings()
    print(
        f"curalina_variants {process} scaffold ready "
        f"on {settings.service_host}:{settings.service_port}"
    )
    return 0


if __name__ == "__main__":  # pragma: no cover
    import sys

    raise SystemExit(main(sys.argv[1] if len(sys.argv) > 1 else "api"))
