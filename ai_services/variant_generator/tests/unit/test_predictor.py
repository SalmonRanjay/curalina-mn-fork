from __future__ import annotations

import numpy as np
import pytest

from curalina_variants.evaluation.predictor import (
    dark_to_light_risk,
    pearson_correlation,
)


def test_dark_to_light_risk_matches_technical_design_formula() -> None:
    assert dark_to_light_risk(source_mean_l=30.0, target_l=80.0) == pytest.approx(0.5)


def test_dark_to_light_risk_floors_at_zero_for_light_to_dark() -> None:
    assert dark_to_light_risk(source_mean_l=80.0, target_l=30.0) == 0.0


def test_pearson_correlation_perfect_positive_and_negative() -> None:
    x = np.array([1.0, 2.0, 3.0, 4.0])
    y = np.array([2.0, 4.0, 6.0, 8.0])
    assert pearson_correlation(x, y) == pytest.approx(1.0)
    assert pearson_correlation(x, -y) == pytest.approx(-1.0)


def test_pearson_correlation_rejects_mismatched_shapes() -> None:
    with pytest.raises(ValueError, match="same shape"):
        pearson_correlation(np.array([1.0, 2.0]), np.array([1.0]))


def test_pearson_correlation_rejects_too_few_samples() -> None:
    with pytest.raises(ValueError, match="at least 2"):
        pearson_correlation(np.array([1.0]), np.array([1.0]))


def test_pearson_correlation_rejects_constant_series() -> None:
    with pytest.raises(ValueError, match="constant"):
        pearson_correlation(np.array([1.0, 1.0, 1.0]), np.array([1.0, 2.0, 3.0]))
