from typing import Dict, Any, List, Tuple
import math
import random
from datetime import date, timedelta

import numpy as np

from .formulas import (
    compute_dew_point,
    compute_heat_index,
    compute_wind_chill,
)


def parse_target_day(value: str) -> Tuple[int, int]:
    parts = value.split("-")
    if len(parts) == 3:
        return int(parts[1]), int(parts[2])
    return int(parts[0]), int(parts[1])


def generate_daily_series(n_days: int, seed: int = 42) -> List[Dict[str, Any]]:
    rng = random.Random(seed)
    series: List[Dict[str, Any]] = []
    base_t = 28 + rng.uniform(-3, 3)
    base_p = 8 + rng.uniform(-4, 4)
    base_w = 22 + rng.uniform(-8, 8)

    for i in range(n_days):
        tmax = base_t + 6 * math.sin(i / 15.0) + rng.uniform(-2, 2)
        tmin = tmax - (5 + rng.uniform(0, 2))
        rh = min(100.0, max(20.0, 65 + rng.uniform(-25, 25)))
        wspd = base_w + 8 * math.sin(i / 9.0) + rng.uniform(-5, 5)
        gust = max(wspd, wspd + rng.uniform(5, 15))
        precip = max(0.0, base_p + 12 * max(0, math.sin(i / 7.0)) + rng.uniform(-5, 5))
        rate = max(0.0, precip / 6 + rng.uniform(0, 3))

        hi = compute_heat_index(tmax, rh)
        dew = compute_dew_point(tmax, rh)
        wc = compute_wind_chill(tmin, max(0.0, wspd))

        series.append(
            {
                "date": None,
                "t2m_max": round(tmax, 1),
                "hi_max": None if hi is None else round(hi, 1),
                "t2m_min": round(tmin, 1),
                "wc_min": None if wc is None else round(wc, 1),
                "wind_speed_max": round(wspd, 1),
                "wind_gust_p95": round(gust, 1),
                "precip_daily": round(precip, 1),
                "precip_rate_max": round(rate, 1),
                "rh_max": round(rh, 1),
                "dewpoint_max": None if dew is None else round(dew, 1),
            }
        )

    return series


def assemble_series(target_month: int, target_day: int, years: int = 20, window: int = 15) -> List[Dict[str, Any]]:
    results: List[Dict[str, Any]] = []
    today = date.today()
    end_year = today.year - 1
    start_year = end_year - (years - 1)
    seed = 1234
    for year in range(start_year, end_year + 1):
        center_day = min(target_day, 28)
        start = date(year, target_month, center_day) - timedelta(days=window)
        rows = generate_daily_series(2 * window + 1, seed=seed + year)
        for offset, row in enumerate(rows):
            row["date"] = (start + timedelta(days=offset)).isoformat()
            results.append(row)
    return results


def exceed(row: Dict[str, Any], condition: str, thr: Dict[str, Any], logic: str) -> bool:
    checks: List[bool] = []

    def has(key: str) -> float | None:
        value = row.get(key)
        return None if value is None else float(value)

    if condition == "hot":
        if thr.get("T_min") is not None and (val := has("t2m_max")) is not None:
            checks.append(val >= float(thr["T_min"]))
        if thr.get("HI_min") is not None and (val := has("hi_max")) is not None:
            checks.append(val >= float(thr["HI_min"]))

    elif condition == "cold":
        if thr.get("T_max") is not None and (val := has("t2m_min")) is not None:
            checks.append(val <= float(thr["T_max"]))
        if thr.get("WC_max") is not None and (val := has("wc_min")) is not None:
            checks.append(val <= float(thr["WC_max"]))

    elif condition == "windy":
        if thr.get("V_min") is not None and (val := has("wind_speed_max")) is not None:
            checks.append(val >= float(thr["V_min"]))
        if thr.get("gust_min") is not None and (val := has("wind_gust_p95")) is not None:
            checks.append(val >= float(thr["gust_min"]))

    elif condition == "wet":
        if thr.get("P_daily") is not None and (val := has("precip_daily")) is not None:
            checks.append(val >= float(thr["P_daily"]))
        if thr.get("P_rate") is not None and (val := has("precip_rate_max")) is not None:
            checks.append(val >= float(thr["P_rate"]))

    elif condition == "muggy":
        if thr.get("HI_min") is not None and (val := has("hi_max")) is not None:
            checks.append(val >= float(thr["HI_min"]))
        if thr.get("Td_min") is not None and (val := has("dewpoint_max")) is not None:
            checks.append(val >= float(thr["Td_min"]))

    if not checks:
        return False
    return all(checks) if logic == "ALL" else any(checks)


def summarize(values: List[float]) -> Dict[str, float]:
    arr = np.array(values, dtype=float)
    return {
        "mean": round(float(np.nanmean(arr)), 1),
        "p10": round(float(np.nanpercentile(arr, 10)), 1),
        "p50": round(float(np.nanpercentile(arr, 50)), 1),
        "p90": round(float(np.nanpercentile(arr, 90)), 1),
    }
