import pytest

from curalina_variants.domain.colour_spec import ColourSpec, RgbColour
from curalina_variants.domain.commercial_status import CommercialAvailability
from curalina_variants.domain.review import ReviewDecision
from curalina_variants.domain.variant_candidate import (
    ALLOWED_JOB_TRANSITIONS,
    TERMINAL_JOB_OUTCOMES,
    JobOutcome,
    VisualVariant,
)

_COLOUR = ColourSpec(colour=RgbColour(10, 20, 30), colour_name="Charcoal")


def _variant(**overrides: object) -> VisualVariant:
    defaults: dict[str, object] = {
        "variant_id": "variant_1",
        "parent_product_id": "product_1",
        "source_asset_id": "asset_1",
        "mask_id": "mask_1",
        "target_colour": _COLOUR,
        "job_outcome": JobOutcome.SUCCEEDED,
    }
    defaults.update(overrides)
    return VisualVariant(**defaults)  # type: ignore[arg-type]


def test_valid_variant_defaults_to_pending_and_conceptual() -> None:
    variant = _variant()
    assert variant.review_status is ReviewDecision.PENDING
    assert variant.commercial_status is CommercialAvailability.CONCEPTUAL
    assert variant.output_asset_id is None


@pytest.mark.parametrize(
    "field_name",
    ["variant_id", "parent_product_id", "source_asset_id", "mask_id"],
)
def test_variant_rejects_blank_identifiers(field_name: str) -> None:
    """Guards the wrong parent/variant relationship case: a blank linking id
    can never silently pass through."""
    with pytest.raises(ValueError, match=field_name):
        _variant(**{field_name: "  "})


def test_variant_rejects_revision_below_one() -> None:
    with pytest.raises(ValueError, match="revision"):
        _variant(revision=0)


def test_commercial_status_cannot_leave_conceptual_without_approval() -> None:
    with pytest.raises(ValueError, match="never collapsed"):
        _variant(commercial_status=CommercialAvailability.CUSTOM_ORDER)


def test_commercial_status_may_leave_conceptual_once_approved() -> None:
    variant = _variant(
        review_status=ReviewDecision.APPROVED,
        commercial_status=CommercialAvailability.SUPPLIER_CONFIRMED,
    )
    assert variant.commercial_status is CommercialAvailability.SUPPLIER_CONFIRMED


def test_output_asset_id_requires_succeeded_job() -> None:
    with pytest.raises(ValueError, match="output_asset_id"):
        _variant(job_outcome=JobOutcome.RUNNING, output_asset_id="asset_out_1")


def test_generation_manifest_is_immutable() -> None:
    variant = _variant(generation_manifest={"fake": True})
    with pytest.raises(TypeError):
        variant.generation_manifest["fake"] = False  # type: ignore[index]


def test_job_transition_table_has_no_outgoing_edges_from_terminal_states() -> None:
    for outcome in TERMINAL_JOB_OUTCOMES:
        assert ALLOWED_JOB_TRANSITIONS[outcome] == frozenset()


def test_job_transition_table_matches_the_documented_state_machine() -> None:
    assert ALLOWED_JOB_TRANSITIONS[JobOutcome.QUEUED] == frozenset(
        {JobOutcome.RUNNING, JobOutcome.CANCELLED}
    )
    assert ALLOWED_JOB_TRANSITIONS[JobOutcome.RUNNING] == frozenset(
        {JobOutcome.SUCCEEDED, JobOutcome.FAILED, JobOutcome.CANCELLED}
    )
