import pytest

from curalina_variants.domain.colour_spec import ColourSpec, MaterialSpec, RgbColour


def test_rgb_colour_hex_roundtrip() -> None:
    colour = RgbColour(18, 52, 86)
    assert colour.hex == "#123456"
    assert RgbColour.from_hex("#123456") == colour


@pytest.mark.parametrize("value", [-1, 256, 1000])
def test_rgb_colour_rejects_out_of_range_channel(value: int) -> None:
    with pytest.raises(ValueError, match="0..255"):
        RgbColour(value, 0, 0)


@pytest.mark.parametrize(
    "bad_code",
    ["123456", "#12345", "#gggggg", "not-a-colour", "#1234567", ""],
)
def test_rgb_colour_from_hex_rejects_bad_colour_codes(bad_code: str) -> None:
    with pytest.raises(ValueError, match="invalid hex colour code"):
        RgbColour.from_hex(bad_code)


def test_material_spec_rejects_blank_name() -> None:
    with pytest.raises(ValueError, match="material_name"):
        MaterialSpec(material_name="   ")


def test_material_spec_rejects_blank_finish_when_provided() -> None:
    with pytest.raises(ValueError, match="finish"):
        MaterialSpec(material_name="velvet", finish="  ")


def test_material_spec_allows_missing_finish() -> None:
    spec = MaterialSpec(material_name="velvet")
    assert spec.finish is None


def test_colour_spec_rejects_blank_colour_name() -> None:
    with pytest.raises(ValueError, match="colour_name"):
        ColourSpec(colour=RgbColour(0, 0, 0), colour_name=" ")


def test_colour_spec_holds_optional_material() -> None:
    spec = ColourSpec(
        colour=RgbColour(10, 20, 30),
        colour_name="Charcoal",
        material=MaterialSpec(material_name="boucle"),
    )
    assert spec.material is not None
    assert spec.material.material_name == "boucle"
