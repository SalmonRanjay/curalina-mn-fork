"""`AssetStore` port: durable storage for generated asset bytes.

Rooms previously held only asset metadata (ADR-0020 C3.1). Implementations
must reject ids that could escape their storage root and must never expose
filesystem paths.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol


class AssetStoreError(Exception):
    """Base class for asset store failures."""


class InvalidAssetIdError(AssetStoreError):
    """The asset id is not a safe identifier."""


@dataclass(frozen=True, slots=True)
class StoredAsset:
    asset_id: str
    data: bytes
    media_type: str


class AssetStore(Protocol):
    def put(self, asset_id: str, data: bytes, *, media_type: str) -> None:
        """Atomically store `data`. Raises `AssetStoreError` on any failure."""
        ...

    def get(self, asset_id: str) -> StoredAsset | None:
        """Return the stored asset, or `None` if unknown or the id is unsafe."""
        ...
