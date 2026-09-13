import pytest

from curalina_rooms.domain.validation import InstanceValidation, Verdict


def test_not_evaluated_verdict_requires_blocked_on() -> None:
    with pytest.raises(ValueError, match="blocked_on"):
        InstanceValidation(
            instance_id="inst_0001",
            expected_product_id="prod_chair_001",
            present=None,
            identity_score=None,
            color_delta_e=None,
            bbox_iou=None,
            verdict=Verdict.NOT_EVALUATED,
            blocked_on=None,
        )


def test_non_not_evaluated_verdict_forbids_blocked_on() -> None:
    with pytest.raises(ValueError, match="blocked_on"):
        InstanceValidation(
            instance_id="inst_0001",
            expected_product_id="prod_chair_001",
            present=True,
            identity_score=0.9,
            color_delta_e=1.0,
            bbox_iou=0.95,
            verdict=Verdict.PASS,
            blocked_on="G02",
        )
