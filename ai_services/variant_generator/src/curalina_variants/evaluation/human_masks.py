"""Turn human-authored editable rectangles into a `Mask`.

`ADR-0012` §D8.6 requires masks to be human-authored per-region, never
background-derived or auto-segmented. The rectangles themselves are the
human judgment — recorded as plain data by whoever reviewed the image, the
same way `golden_scenarios.py` declares its own synthetic geometry as a
labelled fixture field rather than having a notebook mint it. This module
performs no segmentation and derives nothing from pixel content: it only
lays the declared rectangles out into the byte format `Mask` requires.
"""

from __future__ import annotations

from collections.abc import Sequence

import numpy as np

from curalina_variants.domain.mask_spec import Mask, Region

EditableRect = tuple[int, int, int, int]  # (x_px, y_px, width_px, height_px)


def rectangles_to_mask(
    *,
    mask_id: str,
    source_asset_id: str,
    width_px: int,
    height_px: int,
    editable_rects: Sequence[EditableRect],
    protected_subregions: tuple[Region, ...] = (),
    feather_px: int = 3,
    human_corrected: bool = True,
) -> Mask:
    if not editable_rects:
        raise ValueError("editable_rects must declare at least one region")
    grid = np.zeros((height_px, width_px), dtype=np.uint8)
    for x_px, y_px, w_px, h_px in editable_rects:
        if x_px < 0 or y_px < 0 or w_px <= 0 or h_px <= 0:
            raise ValueError(f"invalid editable rectangle {(x_px, y_px, w_px, h_px)!r}")
        if x_px + w_px > width_px or y_px + h_px > height_px:
            raise ValueError(
                f"editable rectangle {(x_px, y_px, w_px, h_px)!r} exceeds "
                f"image bounds {width_px}x{height_px}"
            )
        grid[y_px : y_px + h_px, x_px : x_px + w_px] = 1
    return Mask(
        mask_id=mask_id,
        source_asset_id=source_asset_id,
        width_px=width_px,
        height_px=height_px,
        editable_mask=grid.tobytes(),
        protected_subregions=protected_subregions,
        feather_px=feather_px,
        human_corrected=human_corrected,
    )
