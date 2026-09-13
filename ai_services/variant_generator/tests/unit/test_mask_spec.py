import pytest

from curalina_variants.domain.mask_spec import Mask, Region


def _mask(
    editable_mask: bytes,
    *,
    width: int = 2,
    height: int = 2,
    protected_subregions: tuple[Region, ...] = (),
    feather_px: int = 3,
    revision: int = 1,
) -> Mask:
    return Mask(
        mask_id="mask_1",
        source_asset_id="asset_1",
        width_px=width,
        height_px=height,
        editable_mask=editable_mask,
        protected_subregions=protected_subregions,
        feather_px=feather_px,
        revision=revision,
    )


def test_valid_mask_constructs() -> None:
    mask = _mask(bytes([1, 0, 0, 1]))
    assert mask.width_px == 2
    assert mask.height_px == 2


def test_mask_rejects_length_mismatch() -> None:
    with pytest.raises(ValueError, match="does not match"):
        _mask(bytes([1, 0, 0]))


def test_mask_rejects_byte_values_other_than_zero_or_one() -> None:
    with pytest.raises(ValueError, match="0 \\(protected\\) or 1 \\(editable\\)"):
        _mask(bytes([1, 2, 0, 1]))


def test_mask_rejects_non_positive_dimensions() -> None:
    with pytest.raises(ValueError, match="width_px/height_px must be positive"):
        _mask(b"", width=0, height=0)


def test_mask_rejects_negative_feather() -> None:
    with pytest.raises(ValueError, match="feather_px"):
        _mask(bytes([1, 0, 0, 1]), feather_px=-1)


def test_mask_rejects_revision_below_one() -> None:
    with pytest.raises(ValueError, match="revision"):
        _mask(bytes([1, 0, 0, 1]), revision=0)


def test_mask_rejects_blank_mask_id() -> None:
    with pytest.raises(ValueError, match="mask_id"):
        Mask(
            mask_id=" ",
            source_asset_id="asset_1",
            width_px=1,
            height_px=1,
            editable_mask=bytes([1]),
        )


def test_mask_rejects_blank_source_asset_id() -> None:
    with pytest.raises(ValueError, match="source_asset_id"):
        Mask(
            mask_id="mask_1",
            source_asset_id=" ",
            width_px=1,
            height_px=1,
            editable_mask=bytes([1]),
        )


def test_empty_mask_is_flagged() -> None:
    """Mandatory test case: an all-protected (empty) mask permits nothing."""
    mask = _mask(bytes([0, 0, 0, 0]))
    assert mask.is_empty is True
    assert mask.is_fully_editable is False


def test_all_one_mask_is_flagged_when_protected_regions_expected() -> None:
    """Mandatory test case: an all-editable mask is suspicious whenever
    protected subregions were declared."""
    mask = _mask(
        bytes([1, 1, 1, 1]),
        protected_subregions=(Region(0, 0, 1, 1),),
    )
    assert mask.is_fully_editable is True
    assert mask.is_empty is False


def test_inverted_mask_bytes_are_structurally_valid_but_distinguishable() -> None:
    """An "inverted" mask (editable/protected swapped from what was intended)
    is not something this pure record can detect on its own — it has no
    reference truth to invert against — but two masks with swapped bytes
    must remain distinct values, so a caller comparing against an expected
    mask can catch the inversion."""
    normal = _mask(bytes([1, 0, 0, 1]))
    inverted = _mask(bytes([0, 1, 1, 0]))
    assert normal.editable_mask != inverted.editable_mask


def test_protected_region_exceeding_bounds_is_rejected() -> None:
    with pytest.raises(ValueError, match="exceeds mask bounds"):
        _mask(
            bytes([1, 0, 0, 1]),
            protected_subregions=(Region(1, 1, 5, 5),),
        )


def test_region_rejects_non_positive_size() -> None:
    with pytest.raises(ValueError, match="width_px/height_px must be positive"):
        Region(0, 0, 0, 1)


def test_region_rejects_negative_origin() -> None:
    with pytest.raises(ValueError, match="non-negative"):
        Region(-1, 0, 1, 1)
