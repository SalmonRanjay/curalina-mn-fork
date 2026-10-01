"""Pytest fixtures shared across all variant-generator tests."""

from __future__ import annotations

import base64
import os
import uuid

import pytest

from curalina_variants.api.postgres_store import PostgresJobStore
from curalina_variants.api.schemas import CreateMaskRequest
from curalina_variants.api.store import FakeJobStore

TEST_DATABASE_URL = os.environ.get(
    "CURALINA_TEST_DATABASE_URL",
    "postgresql://curalina:curalina_dev_password@localhost:5432/curalina_variants_test",
)


def unique_test_schema() -> str:
    """A fresh, valid Postgres schema identifier, unique per call.

    Gives each test SQLite-tmp-file-equivalent isolation inside one shared
    Postgres test database.
    """
    return f"test_{uuid.uuid4().hex[:16]}"


def _create_default_mask_in_store(store: FakeJobStore | PostgresJobStore) -> None:
    """Helper to ingest the default mask used by all test fixtures.

    Works with both FakeJobStore and PostgresJobStore."""
    mask_request = CreateMaskRequest(
        mask_id="mask_000001",
        source_asset_id="asset_000001",
        width_px=2,
        height_px=2,
        editable_mask_b64=base64.b64encode(bytes([1, 1, 1, 1])).decode("utf-8"),
        protected_subregions=[],
        feather_band_px=3,
        human_corrected=False,
        revision=1,
    )
    store.create_mask(mask_request, request_id="fixture-setup")


@pytest.fixture
def store() -> FakeJobStore:
    """Provides a FakeJobStore with the default mask pre-ingested.

    The mask has ID 'mask_000001', dimensions 2x2, all pixels editable,
    matching the create_variant_job_request.json fixture. This is the
    standard fixture for tests that create variant jobs. Tests that need
    a truly empty store should use store_empty() instead."""
    store_obj = FakeJobStore()
    _create_default_mask_in_store(store_obj)
    return store_obj


@pytest.fixture
def store_empty() -> FakeJobStore:
    """Provides a fresh, empty FakeJobStore for tests that need no fixtures.

    Use this for tests that need to verify error behavior for missing
    resources (e.g., mask-not-found)."""
    return FakeJobStore()


@pytest.fixture
def postgres_store() -> PostgresJobStore:
    """Provides a PostgresJobStore with the default mask pre-ingested.

    This is useful for tests that need to verify Postgres-specific behavior
    (durability, persistence, etc.) while also being able to create jobs.
    Each test gets its own Postgres schema for SQLite-tmp-file-equivalent
    isolation."""
    store_obj = PostgresJobStore(TEST_DATABASE_URL, schema=unique_test_schema())
    store_obj.initialize()
    _create_default_mask_in_store(store_obj)
    return store_obj
