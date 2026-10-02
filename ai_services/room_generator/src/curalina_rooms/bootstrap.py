import logging
import time

from curalina_rooms.settings import Settings

logger = logging.getLogger("curalina_rooms")

# How long to back off after an unhandled error in the poll loop (e.g. a
# transient Postgres connection drop) before trying again, and the cap on
# that backoff after repeated consecutive failures. Without this, the
# process previously had no retry at all: a single transient connection
# error propagated out of run_worker_once and killed the worker outright,
# relying entirely on `restart: unless-stopped` at the Docker level to
# notice and recover -- which this incident showed is not the same as
# actually recovering (see STATUS.md and docs/runbooks/render-troubleshooting.md).
_ERROR_BACKOFF_INITIAL_SECONDS = 2
_ERROR_BACKOFF_MAX_SECONDS = 30


def build_settings() -> Settings:
    return Settings()


def run_api(settings: Settings) -> int:
    import uvicorn

    from curalina_rooms.api.app import create_app

    uvicorn.run(create_app(), host=settings.service_host, port=settings.service_port)
    return 0


def run_worker(settings: Settings) -> int:
    from curalina_rooms.workers.runner import run_worker_once

    logger.info("rooms worker starting: polling for queued concept-render jobs")
    backoff = _ERROR_BACKOFF_INITIAL_SECONDS
    while True:
        try:
            processed = run_worker_once(settings) == 0
        except Exception:
            # A transient error (e.g. a dropped Postgres connection) must
            # never silently end job processing -- log it loudly, back off,
            # and keep polling rather than exiting the process.
            logger.exception(
                "rooms worker: error while polling/processing a job - retrying in %ss",
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
    # Explicit, not inherited: Alembic's env.py calls fileConfig() on every
    # store.initialize() (i.e. every worker poll), which reapplies
    # alembic.ini's own [logger_root] level=WARN to the root logger. This
    # logger has no handler of its own, so without an explicit level here
    # it silently inherits root's level -- meaning the first fileConfig()
    # call downgrades it from the INFO set above to WARN, and every
    # subsequent job-processing log line goes dark with no error. Setting
    # the level directly on this named logger makes it immune to whatever
    # alembic does to root afterward.
    logger.setLevel(logging.INFO)
    settings = build_settings()
    if process == "worker":
        return run_worker(settings)
    return run_api(settings)


if __name__ == "__main__":  # pragma: no cover
    import sys

    raise SystemExit(main(sys.argv[1] if len(sys.argv) > 1 else "api"))
