import time

from curalina_variants.settings import Settings


def build_settings() -> Settings:
    return Settings()


def run_api(settings: Settings) -> int:
    import uvicorn

    from curalina_variants.api.app import create_app

    uvicorn.run(create_app(), host=settings.service_host, port=settings.service_port)
    return 0


def run_worker(settings: Settings) -> int:
    from curalina_variants.workers.runner import run_worker_once

    while True:
        processed = run_worker_once(settings) == 0
        if not processed:
            time.sleep(1)


def main(process: str = "api") -> int:
    settings = build_settings()
    if process == "worker":
        return run_worker(settings)
    return run_api(settings)


if __name__ == "__main__":  # pragma: no cover
    import sys

    raise SystemExit(main(sys.argv[1] if len(sys.argv) > 1 else "api"))
