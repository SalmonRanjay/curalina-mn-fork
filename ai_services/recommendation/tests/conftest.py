"""Shared Postgres test-database plumbing for recommendation's test suite.

Replaces the old "one SQLite file per test via tmp_path" isolation pattern.
Tests share one physical Postgres database (set up once, out of band — see
`ai_services/recommendation/README.md` / the repo-root Postgres container)
and get SQLite-tmp-file-equivalent isolation by giving each test its own
Postgres schema instead. `curalina_recommendation.db.migrator.run_migrations`
creates the schema if missing, so no separate test setup step is required —
only a reachable Postgres instance.
"""

from __future__ import annotations

import os
import uuid

TEST_DATABASE_URL = os.environ.get(
    "CURALINA_TEST_DATABASE_URL",
    "postgresql://curalina:curalina_dev_password@localhost:5432/"
    "curalina_recommendation_test",
)


def unique_test_schema() -> str:
    """A fresh, valid Postgres schema identifier, unique per call."""
    return f"test_{uuid.uuid4().hex[:16]}"
