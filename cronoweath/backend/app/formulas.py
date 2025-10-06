# backend/app/formulas.py
"""Common meteorological formulas used across data engines.

All functions accept/return SI units (temperature in Celsius, wind in km/h,
relative humidity in percentage) unless otherwise noted.
"""
from __future__ import annotations

import math
from typing import Optional


def c_to_f(temp_c: float) -> float:
    return temp_c * 9.0 / 5.0 + 32.0


def f_to_c(temp_f: float) -> float:
    return (temp_f - 32.0) * 5.0 / 9.0


def kmh_to_mph(speed_kmh: float) -> float:
    return speed_kmh * 0.621371


def compute_heat_index(temp_c: Optional[float], rh_pct: Optional[float]) -> Optional[float]:
    """Heat Index Rothfusz regression (returns temperature in °C).

    NOAA guidance limits applicability to T >= 26.7 °C (80 °F) and RH >= 40 %.
    For lower ranges we return the dry-bulb temperature as-is.
    """
    if temp_c is None or rh_pct is None or rh_pct <= 0:
        return None

    temp_f = c_to_f(temp_c)
    if temp_f < 80 or rh_pct < 40:
        return round(temp_c, 2)

    t = temp_f
    r = float(rh_pct)
    hi_f = (
        -42.379
        + 2.04901523 * t
        + 10.14333127 * r
        - 0.22475541 * t * r
        - 0.00683783 * t * t
        - 0.05481717 * r * r
        + 0.00122874 * t * t * r
        + 0.00085282 * t * r * r
        - 0.00000199 * t * t * r * r
    )

    # Adjustments for extreme humidity ranges (NOAA)
    if r < 13 and 80 <= t <= 112:
        hi_f -= ((13 - r) / 4) * math.sqrt((17 - abs(t - 95)) / 17)
    elif r > 85 and 80 <= t <= 87:
        hi_f += ((r - 85) / 10) * ((87 - t) / 5)

    hi_c = f_to_c(hi_f)
    return round(hi_c if hi_c >= temp_c else temp_c, 2)


def compute_wind_chill(temp_c: Optional[float], wind_kmh: Optional[float]) -> Optional[float]:
    """Wind chill index (returns °C). Valid for T <= 10 °C and wind >= 4.8 km/h."""
    if temp_c is None or wind_kmh is None:
        return None
    if temp_c > 10 or wind_kmh < 4.8:
        return round(temp_c, 2)

    t_f = c_to_f(temp_c)
    v_mph = kmh_to_mph(wind_kmh)
    wc_f = 35.74 + 0.6215 * t_f - 35.75 * (v_mph ** 0.16) + 0.4275 * t_f * (v_mph ** 0.16)
    wc_c = f_to_c(wc_f)
    return round(wc_c, 2)


def compute_dew_point(temp_c: Optional[float], rh_pct: Optional[float]) -> Optional[float]:
    """Magnus-Tetens approximation for dew point (°C)."""
    if temp_c is None or rh_pct is None or rh_pct <= 0:
        return None
    rh_frac = rh_pct / 100.0
    if rh_frac <= 0:
        return None
    a, b = 17.27, 237.7
    gamma = (a * temp_c) / (b + temp_c) + math.log(rh_frac)
    td = (b * gamma) / (a - gamma)
    return round(td, 2)


__all__ = [
    "compute_heat_index",
    "compute_wind_chill",
    "compute_dew_point",
]
