"""Small sRGB/CIELAB/CIEDE2000 implementation for V01.

No OpenCV/scikit-image dependency lives in the package fast path. The
conversion constants are D65/sRGB and are checked in unit tests against the
canonical values named by ADR-0012.
"""

from __future__ import annotations

import numpy as np
from numpy.typing import NDArray

FloatArray = NDArray[np.float64]
BoolArray = NDArray[np.bool_]
UInt8Array = NDArray[np.uint8]

_WHITE_D65 = np.array([0.95047, 1.0, 1.08883], dtype=np.float64)
_RGB_TO_XYZ = np.array(
    [
        [0.4124564, 0.3575761, 0.1804375],
        [0.2126729, 0.7151522, 0.0721750],
        [0.0193339, 0.1191920, 0.9503041],
    ],
    dtype=np.float64,
)
_XYZ_TO_RGB = np.array(
    [
        [3.2404542, -1.5371385, -0.4985314],
        [-0.9692660, 1.8760108, 0.0415560],
        [0.0556434, -0.2040259, 1.0572252],
    ],
    dtype=np.float64,
)


def srgb_u8_to_lab(rgb: UInt8Array) -> FloatArray:
    srgb = rgb.astype(np.float64) / 255.0
    linear = _srgb_to_linear(srgb)
    xyz = np.tensordot(linear, _RGB_TO_XYZ.T, axes=1)
    return _xyz_to_lab(xyz)


def lab_to_srgb_u8(lab: FloatArray) -> tuple[UInt8Array, BoolArray]:
    xyz = _lab_to_xyz(lab)
    linear = np.tensordot(xyz, _XYZ_TO_RGB.T, axes=1)
    clipped = np.any((linear < 0.0) | (linear > 1.0), axis=-1)
    srgb = _linear_to_srgb(np.clip(linear, 0.0, 1.0))
    return np.rint(np.clip(srgb, 0.0, 1.0) * 255.0).astype(np.uint8), clipped


def delta_e00(lab_a: FloatArray, lab_b: FloatArray) -> FloatArray:
    l1, a1, b1 = np.moveaxis(lab_a.astype(np.float64), -1, 0)
    l2, a2, b2 = np.moveaxis(lab_b.astype(np.float64), -1, 0)

    c1 = np.sqrt(a1 * a1 + b1 * b1)
    c2 = np.sqrt(a2 * a2 + b2 * b2)
    c_bar = (c1 + c2) / 2.0
    c_bar7 = c_bar**7
    g = 0.5 * (1.0 - np.sqrt(c_bar7 / (c_bar7 + 25.0**7)))

    a1p = (1.0 + g) * a1
    a2p = (1.0 + g) * a2
    c1p = np.sqrt(a1p * a1p + b1 * b1)
    c2p = np.sqrt(a2p * a2p + b2 * b2)
    h1p = _hue_degrees(b1, a1p)
    h2p = _hue_degrees(b2, a2p)

    dlp = l2 - l1
    dcp = c2p - c1p
    dhp = _delta_hue(h1p, h2p, c1p, c2p)
    dhp_term = 2.0 * np.sqrt(c1p * c2p) * np.sin(np.deg2rad(dhp / 2.0))

    lp_bar = (l1 + l2) / 2.0
    cp_bar = (c1p + c2p) / 2.0
    hp_bar = _mean_hue(h1p, h2p, c1p, c2p)

    t = (
        1.0
        - 0.17 * np.cos(np.deg2rad(hp_bar - 30.0))
        + 0.24 * np.cos(np.deg2rad(2.0 * hp_bar))
        + 0.32 * np.cos(np.deg2rad(3.0 * hp_bar + 6.0))
        - 0.20 * np.cos(np.deg2rad(4.0 * hp_bar - 63.0))
    )
    delta_theta = 30.0 * np.exp(-((hp_bar - 275.0) / 25.0) ** 2)
    cp_bar7 = cp_bar**7
    rc = 2.0 * np.sqrt(cp_bar7 / (cp_bar7 + 25.0**7))
    sl = 1.0 + (0.015 * (lp_bar - 50.0) ** 2) / np.sqrt(
        20.0 + (lp_bar - 50.0) ** 2
    )
    sc = 1.0 + 0.045 * cp_bar
    sh = 1.0 + 0.015 * cp_bar * t
    rt = -np.sin(np.deg2rad(2.0 * delta_theta)) * rc

    result: FloatArray = np.sqrt(
        (dlp / sl) ** 2
        + (dcp / sc) ** 2
        + (dhp_term / sh) ** 2
        + rt * (dcp / sc) * (dhp_term / sh)
    )
    return result


def _srgb_to_linear(srgb: FloatArray) -> FloatArray:
    return np.where(srgb <= 0.04045, srgb / 12.92, ((srgb + 0.055) / 1.055) ** 2.4)


def _linear_to_srgb(linear: FloatArray) -> FloatArray:
    return np.where(
        linear <= 0.0031308,
        linear * 12.92,
        1.055 * np.power(linear, 1.0 / 2.4) - 0.055,
    )


def _xyz_to_lab(xyz: FloatArray) -> FloatArray:
    scaled = xyz / _WHITE_D65
    f = _lab_f(scaled)
    l_star = 116.0 * f[..., 1] - 16.0
    a_star = 500.0 * (f[..., 0] - f[..., 1])
    b_star = 200.0 * (f[..., 1] - f[..., 2])
    return np.stack((l_star, a_star, b_star), axis=-1)


def _lab_to_xyz(lab: FloatArray) -> FloatArray:
    l_star = lab[..., 0]
    a_star = lab[..., 1]
    b_star = lab[..., 2]
    fy = (l_star + 16.0) / 116.0
    fx = fy + a_star / 500.0
    fz = fy - b_star / 200.0
    return _WHITE_D65 * _lab_f_inv(np.stack((fx, fy, fz), axis=-1))


def _lab_f(value: FloatArray) -> FloatArray:
    epsilon = 216.0 / 24389.0
    kappa = 24389.0 / 27.0
    return np.where(value > epsilon, np.cbrt(value), (kappa * value + 16.0) / 116.0)


def _lab_f_inv(value: FloatArray) -> FloatArray:
    epsilon = 216.0 / 24389.0
    kappa = 24389.0 / 27.0
    cubed = value**3
    return np.where(cubed > epsilon, cubed, (116.0 * value - 16.0) / kappa)


def _hue_degrees(b: FloatArray, a: FloatArray) -> FloatArray:
    hue = np.rad2deg(np.arctan2(b, a))
    return np.where(hue < 0.0, hue + 360.0, hue)


def _delta_hue(
    h1: FloatArray, h2: FloatArray, c1: FloatArray, c2: FloatArray
) -> FloatArray:
    raw = h2 - h1
    adjusted = np.where(raw > 180.0, raw - 360.0, raw)
    adjusted = np.where(adjusted < -180.0, adjusted + 360.0, adjusted)
    return np.where((c1 * c2) == 0.0, 0.0, adjusted)


def _mean_hue(
    h1: FloatArray, h2: FloatArray, c1: FloatArray, c2: FloatArray
) -> FloatArray:
    abs_diff = np.abs(h1 - h2)
    simple = (h1 + h2) / 2.0
    wrapped = np.where(
        h1 + h2 < 360.0,
        (h1 + h2 + 360.0) / 2.0,
        (h1 + h2 - 360.0) / 2.0,
    )
    mean = np.where(abs_diff <= 180.0, simple, wrapped)
    return np.where((c1 * c2) == 0.0, h1 + h2, mean)
