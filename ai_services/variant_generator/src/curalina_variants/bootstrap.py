import logging
import time

from curalina_variants.settings import Settings

logger = logging.getLogger("curalina_variants")

# See the identical constants/comment in curalina_rooms/bootstrap.py -- same
# incident, same fix, same reasoning: a transient error (e.g. a dropped
# Postgres connection) must not silently end job processing.
_ERROR_BACKOFF_INITIAL_SECONDS = 2
_ERROR_BACKOFF_MAX_SECONDS = 30


def build_settings() -> Settings:
    return Settings()


def run_api(settings: Settings) -> int:
    import uvicorn

    from curalina_variants.api.app import create_app

    uvicorn.run(create_app(), host=settings.service_host, port=settings.service_port)
    return 0


def run_worker(settings: Settings) -> int:
    from curalina_variants.workers.runner import run_worker_once

    logger.info("variants worker starting: polling for queued jobs")
    backoff = _ERROR_BACKOFF_INITIAL_SECONDS
    while True:
        try:
            processed = run_worker_once(settings) == 0
        except Exception:
            logger.exception(
                "variants worker: error while polling/processing a job - retrying in %ss",
                backoff,
            )
            time.sleep(backoff)
            backoff = min(backoff * 2, _ERROR_BACKOFF_MAX_SECONDS)
            continue
        backoff = _ERROR_BACKOFF_INITIAL_SECONDS
        if not processed:
            time.sleep(1)


def main(process: str = "api") -> int:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )
    # Explicit, not inherited: see the identical comment in
    # curalina_rooms/bootstrap.py -- fileConfig() reapplying
    # alembic.ini's [logger_root] level=WARN on every poll otherwise
    # silently downgrades this logger via inheritance.
    logger.setLevel(logging.INFO)
    settings = build_settings()
    if process == "worker":
        return run_worker(settings)
    return run_api(settings)


if __name__ == "__main__":  # pragma: no cover
    import sys

    raise SystemExit(main(sys.argv[1] if len(sys.argv) > 1 else "api"))
