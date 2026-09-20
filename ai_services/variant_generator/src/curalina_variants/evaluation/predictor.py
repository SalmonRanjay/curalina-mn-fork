"""V01 failure-predictor comparison (`ADR-0012` Finding 5).

`agentic_flow/15_variant_generation_technical_design.md` specifies
`dark_to_light_risk` as the detector for gamut-clipping failure. `ADR-0012`'s
own probe found it uncorrelated with observed clipping (r = +0.034) and the
mask region's `std(L*)` far more predictive (r = +0.720) — but that finding
is a probe result, not a V01 result, and must be re-derived on this run's
own admitted pairs rather than cited. `std(L*)` itself is already computed
per pair as `TransferMetrics.source_mask_l_std`; this module supplies the
`dark_to_light_risk` formula (implemented only so it can be re-tested, not
to endorse it) and a small correlation helper so no notebook cell computes
either.
"""

from __future__ import annotations

import numpy as np
from numpy.typing import NDArray


def dark_to_light_risk(source_mean_l: float, target_l: float) -> float:
    """`agentic_flow/15_variant_generation_technical_design.md`'s formula:
    `max(0, (target_L - source_mean_L) / 100)`. Evidenced as a poor
    predictor of gamut clipping on the ADR-0012 probe corpus; kept here only
    so this run can re-test that finding on its own pairs."""
    return max(0.0, (target_l - source_mean_l) / 100.0)


def pearson_correlation(x: NDArray[np.float64], y: NDArray[np.float64]) -> float:
    x_arr = np.asarray(x, dtype=np.float64)
    y_arr = np.asarray(y, dtype=np.float64)
    if x_arr.shape != y_arr.shape:
        raise ValueError("x and y must have the same shape")
    if x_arr.size < 2:
        raise ValueError("pearson_correlation needs at least 2 samples")
    if np.std(x_arr) == 0.0 or np.std(y_arr) == 0.0:
        raise ValueError("pearson_correlation is undefined for a constant series")
    matrix = np.corrcoef(x_arr, y_arr)
    return float(matrix[0, 1])
