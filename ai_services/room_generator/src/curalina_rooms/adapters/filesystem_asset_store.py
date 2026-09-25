"""Filesystem `AssetStore` under the service data directory."""

from __future__ import annotations

import os
import re
import tempfile
from pathlib import Path

from curalina_rooms.ports.asset_store import (
    AssetStoreError,
    InvalidAssetIdError,
    StoredAsset,
)

_SAFE_ID = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$")
_EXTENSIONS = {"image/png": ".png"}


class FilesystemAssetStore:
    def __init__(self, root: Path) -> None:
        self._root = root

    def _path(self, asset_id: str, extension: str) -> Path:
        if not _SAFE_ID.fullmatch(asset_id):
            raise InvalidAssetIdError(f"unsafe asset id: {asset_id!r}")
        return self._root / f"{asset_id}{extension}"

    def put(self, asset_id: str, data: bytes, *, media_type: str) -> None:
        extension = _EXTENSIONS.get(media_type)
        if extension is None:
            raise AssetStoreError(f"unsupported media type: {media_type!r}")
        target = self._path(asset_id, extension)
        temp_name: str | None = None
        try:
            self._root.mkdir(parents=True, exist_ok=True)
            fd, temp_name = tempfile.mkstemp(dir=self._root, suffix=".tmp")
            with os.fdopen(fd, "wb") as handle:
                handle.write(data)
                handle.flush()
                os.fsync(handle.fileno())
            os.replace(temp_name, target)
            temp_name = None
        except OSError as exc:
            raise AssetStoreError(f"could not write asset: {exc}") from exc
        finally:
            if temp_name is not None:
                Path(temp_name).unlink(missing_ok=True)

    def get(self, asset_id: str) -> StoredAsset | None:
        for media_type, extension in _EXTENSIONS.items():
            try:
                path = self._path(asset_id, extension)
            except InvalidAssetIdError:
                return None
            try:
                data = path.read_bytes()
            except FileNotFoundError:
                continue
            except OSError as exc:
                raise AssetStoreError(f"could not read asset: {exc}") from exc
            return StoredAsset(asset_id=asset_id, data=data, media_type=media_type)
        return None
