import pytest

from curalina_variants.adapters.fake_colour_transfer import FakeColourTransferAdapter
from curalina_variants.adapters.fake_diffusion_refinement import (
    FakeDiffusionRefinementAdapter,
)
from curalina_variants.application.generate_variants import (
    DiffusionRefinementRequested,
    GenerateCandidateRequest,
    GenerateCandidateUseCase,
)
from curalina_variants.domain.colour_spec import ColourSpec, RgbColour
from curalina_variants.domain.commercial_status import CommercialAvailability
from curalina_variants.domain.mask_spec import Mask
from curalina_variants.domain.review import ReviewDecision
from curalina_variants.domain.variant_candidate import JobOutcome

_MASK = Mask(
    mask_id="mask_1",
    source_asset_id="asset_1",
    width_px=1,
    height_px=1,
    editable_mask=bytes([1]),
)
_COLOUR = ColourSpec(colour=RgbColour(10, 20, 30), colour_name="Charcoal")


def _request(**overrides: object) -> GenerateCandidateRequest:
    defaults: dict[str, object] = {
        "variant_id": "variant_1",
        "parent_product_id": "product_1",
        "source_asset_id": "asset_1",
        "mask": _MASK,
        "source_image": b"source-bytes",
        "target_colour": _COLOUR,
    }
    defaults.update(overrides)
    return GenerateCandidateRequest(**defaults)  # type: ignore[arg-type]


def test_generate_candidate_uses_only_the_fake_colour_transfer_by_default() -> None:
    use_case = GenerateCandidateUseCase(colour_transfer=FakeColourTransferAdapter())

    variant = use_case.execute(_request())

    assert variant.job_outcome is JobOutcome.SUCCEEDED
    assert variant.review_status is ReviewDecision.PENDING
    assert variant.commercial_status is CommercialAvailability.CONCEPTUAL
    assert variant.generation_manifest["colour_transfer"]["fake"] is True
    assert "diffusion_refinement" not in variant.generation_manifest


def test_generate_candidate_records_diffusion_refinement_when_requested() -> None:
    use_case = GenerateCandidateUseCase(
        colour_transfer=FakeColourTransferAdapter(),
        diffusion_refinement=FakeDiffusionRefinementAdapter(),
    )

    variant = use_case.execute(_request(use_diffusion_refinement=True))

    assert variant.generation_manifest["diffusion_refinement"]["fake"] is True


def test_generate_candidate_rejects_diffusion_refinement_without_an_adapter() -> None:
    use_case = GenerateCandidateUseCase(colour_transfer=FakeColourTransferAdapter())

    with pytest.raises(DiffusionRefinementRequested):
        use_case.execute(_request(use_diffusion_refinement=True))


def test_generate_candidate_never_produces_an_approved_or_purchasable_result() -> None:
    """No candidate is ever treated as approved or purchasable merely because
    generation returned success — the A2 done-evidence bar."""
    use_case = GenerateCandidateUseCase(colour_transfer=FakeColourTransferAdapter())

    variant = use_case.execute(_request())

    assert variant.review_status is not ReviewDecision.APPROVED
    assert variant.commercial_status is CommercialAvailability.CONCEPTUAL
