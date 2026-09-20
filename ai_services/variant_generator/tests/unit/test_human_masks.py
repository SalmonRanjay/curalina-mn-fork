from __future__ import annotations

import numpy as np
import pytest

from curalina_variants.domain.mask_spec import Region
from curalina_variants.evaluation.human_masks import rectangles_to_mask
from curalina_variants.evaluation.metrics import mask_to_bool


def test_rectangles_to_mask_marks_only_declared_regions() -> None:
    mask = rectangles_to_mask(
        mask_id="mask_1",
        source_asset_id="asset_1",
        width_px=4,
        height_px=4,
        editable_rects=[(1, 1, 2, 2)],
    )

    grid = mask_to_bool(mask)
    assert grid.sum() == 4
    assert bool(grid[1, 1]) and bool(grid[2, 2])
    assert not bool(grid[0, 0])
    assert mask.human_corrected is True


def test_rectangles_to_mask_supports_multi_regions_and_protected() -> None:
    mask = rectangles_to_mask(
        mask_id="mask_2",
        source_asset_id="asset_2",
        width_px=6,
        height_px=6,
        editable_rects=[(0, 0, 2, 2), (4, 4, 2, 2)],
        protected_subregions=(Region(2, 2, 1, 1),),
        feather_px=5,
    )

    grid = mask_to_bool(mask)
    assert grid.sum() == 8
    assert mask.feather_px == 5
    assert mask.protected_subregions == (Region(2, 2, 1, 1),)


def test_rectangles_to_mask_rejects_empty_rects() -> None:
    with pytest.raises(ValueError, match="at least one"):
        rectangles_to_mask(
            mask_id="m",
            source_asset_id="a",
            width_px=2,
            height_px=2,
            editable_rects=[],
        )


def test_rectangles_to_mask_rejects_out_of_bounds_rect() -> None:
    with pytest.raises(ValueError, match="exceeds"):
        rectangles_to_mask(
            mask_id="m",
            source_asset_id="a",
            width_px=2,
            height_px=2,
            editable_rects=[(1, 1, 5, 5)],
        )


def test_rectangles_to_mask_rejects_negative_or_zero_size_rect() -> None:
    with pytest.raises(ValueError, match="invalid editable rectangle"):
        rectangles_to_mask(
            mask_id="m",
            source_asset_id="a",
            width_px=2,
            height_px=2,
            editable_rects=[(0, 0, 0, 1)],
        )
    with np.errstate(all="ignore"):
        with pytest.raises(ValueError, match="invalid editable rectangle"):
            rectangles_to_mask(
                mask_id="m",
                source_asset_id="a",
                width_px=2,
                height_px=2,
                editable_rects=[(-1, 0, 1, 1)],
            )
