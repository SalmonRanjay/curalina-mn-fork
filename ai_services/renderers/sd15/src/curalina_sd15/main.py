"""Uvicorn entrypoint: `python -m curalina_sd15.main`."""

from __future__ import annotations

import os

import uvicorn

from .app import create_app


def main() -> None:
    uvicorn.run(
        create_app(), host="0.0.0.0", port=int(os.environ.get("SERVICE_PORT", "8104"))
    )


if __name__ == "__main__":
    main()
