"""Pytest fixtures shared across all variant-generator tests."""

from __future__ import annotations

import base64
from pathlib import Path

import pytest

from curalina_variants.api.schemas import CreateMaskRequest
from curalina_variants.api.sqlite_store import SQLiteJobStore
from curalina_variants.api.store import FakeJobStore


def _create_default_mask_in_store(store: FakeJobStore | SQLiteJobStore) -> None:
    """Helper to ingest the default mask used by all test fixtures.

    Works with both FakeJobStore and SQLiteJobStore."""
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
def sqlite_store(tmp_path: Path) -> SQLiteJobStore:
    """Provides an SQLiteJobStore with the default mask pre-ingested.

    This is useful for tests that need to verify SQLite-specific behavior
    (durability, persistence, etc.) while also being able to create jobs."""
    store_obj = SQLiteJobStore(tmp_path / "variants.sqlite3")
    store_obj.initialize()
    _create_default_mask_in_store(store_obj)
    return store_obj
