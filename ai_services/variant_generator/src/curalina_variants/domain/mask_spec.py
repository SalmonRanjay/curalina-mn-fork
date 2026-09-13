"""Per-region editable/protected mask records.

Pure, framework-free: `editable_mask` is stored as raw `bytes` (one byte per
pixel, row-major, `1 == editable` / `0 == protected`) rather than a NumPy
array, so this module never imports NumPy/PIL/OpenCV. Real mask *production*
(manual annotation or SAM) and real mask *application* (feathered
compositing) are adapter/application concerns for later phases; this module
only defines the record and its structural invariants.
"""

from __future__ import annotations

from dataclasses import dataclass, field

_EDITABLE = 1
_PROTECTED = 0


@dataclass(frozen=True, slots=True)
class Region:
    """A rectangular protected subregion (e.g. legs, hardware, piping) in
    source-image pixel coordinates."""

    x_px: int
    y_px: int
    width_px: int
    height_px: int

    def __post_init__(self) -> None:
        if self.x_px < 0 or self.y_px < 0:
            raise ValueError("Region origin (x_px, y_px) must be non-negative")
        if self.width_px <= 0 or self.height_px <= 0:
            raise ValueError("Region width_px/height_px must be positive")


@dataclass(frozen=True, slots=True)
class Mask:
    """A per-region editable mask for one source asset.

    `width_px`/`height_px` must match the source image exactly (per
    `agentic_flow/15_variant_generation_technical_design.md`'s `MaskSpec`).
    `feather_px` documents the explicit feather-band policy; compositing
    that actually uses it is later, real-logic work.
    """

    mask_id: str
    source_asset_id: str
    width_px: int
    height_px: int
    editable_mask: bytes
    protected_subregions: tuple[Region, ...] = field(default_factory=tuple)
    feather_px: int = 3
    human_corrected: bool = False
    revision: int = 1

    def __post_init__(self) -> None:
        if not self.mask_id.strip():
            raise ValueError("Mask.mask_id must not be blank")
        if not self.source_asset_id.strip():
            raise ValueError("Mask.source_asset_id must not be blank")
        if self.width_px <= 0 or self.height_px <= 0:
            raise ValueError("Mask width_px/height_px must be positive")
        expected_len = self.width_px * self.height_px
        if len(self.editable_mask) != expected_len:
            raise ValueError(
                "editable_mask length "
                f"{len(self.editable_mask)} does not match "
                f"{self.width_px}x{self.height_px}={expected_len} pixels"
            )
        if any(byte not in (_EDITABLE, _PROTECTED) for byte in self.editable_mask):
            raise ValueError(
                "editable_mask bytes must each be 0 (protected) or 1 (editable)"
            )
        if self.feather_px < 0:
            raise ValueError("Mask.feather_px must be >= 0")
        if self.revision < 1:
            raise ValueError("Mask.revision must be >= 1")
        for region in self.protected_subregions:
            if (
                region.x_px + region.width_px > self.width_px
                or region.y_px + region.height_px > self.height_px
            ):
                raise ValueError(
                    f"protected subregion {region!r} exceeds mask bounds "
                    f"({self.width_px}x{self.height_px})"
                )

    @property
    def is_empty(self) -> bool:
        """True when no pixel is editable — nothing this mask permits
        recolouring. Part of the mandatory "empty mask" test case."""
        return all(byte == _PROTECTED for byte in self.editable_mask)

    @property
    def is_fully_editable(self) -> bool:
        """True when every pixel is editable. Suspicious whenever
        `protected_subregions` is non-empty — part of the mandatory
        "all-one mask when protected regions exist" test case."""
        return all(byte == _EDITABLE for byte in self.editable_mask)
