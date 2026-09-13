from curalina_variants.adapters.fake_colour_transfer import FakeColourTransferAdapter
from curalina_variants.adapters.fake_diffusion_refinement import (
    FakeDiffusionRefinementAdapter,
)
from curalina_variants.domain.colour_spec import RgbColour
from curalina_variants.domain.mask_spec import Mask

_MASK = Mask(
    mask_id="mask_1",
    source_asset_id="asset_1",
    width_px=1,
    height_px=1,
    editable_mask=bytes([1]),
)


def test_fake_colour_transfer_is_a_labelled_passthrough() -> None:
    adapter = FakeColourTransferAdapter()
    source = b"not-a-real-image"

    result = adapter.transfer(source, _MASK, RgbColour(1, 2, 3))

    assert result.image_bytes == source
    assert result.diagnostics["fake"] is True
    assert "no LAB colour-space math" in result.diagnostics["note"]


def test_fake_colour_transfer_is_deterministic() -> None:
    adapter = FakeColourTransferAdapter()
    source = b"same-input"

    first = adapter.transfer(source, _MASK, RgbColour(1, 2, 3))
    second = adapter.transfer(source, _MASK, RgbColour(1, 2, 3))

    assert first == second


def test_fake_diffusion_refinement_is_a_labelled_passthrough() -> None:
    adapter = FakeDiffusionRefinementAdapter()
    precoloured = b"not-a-real-sdxl-output"

    result = adapter.refine(precoloured, _MASK, "sofa", "Charcoal", seed=42)

    assert result.image_bytes == precoloured
    assert result.diagnostics["fake"] is True
    assert "no SDXL inference" in result.diagnostics["note"]
    assert result.diagnostics["seed"] == 42


def test_fake_diffusion_refinement_is_deterministic() -> None:
    adapter = FakeDiffusionRefinementAdapter()
    precoloured = b"same-input"

    first = adapter.refine(precoloured, _MASK, "sofa", "Charcoal", seed=1)
    second = adapter.refine(precoloured, _MASK, "sofa", "Charcoal", seed=1)

    assert first == second
