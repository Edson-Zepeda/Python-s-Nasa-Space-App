# backend/app/meteomatics_engine.py
from __future__ import annotations

import os
from datetime import date, timedelta
from typing import Any, Dict, List, Tuple

import httpx
import numpy as np

from .formulas import compute_dew_point, compute_heat_index, compute_wind_chill

BASE_URL = "https://api.meteomatics.com"
PARAMETERS = {
    "t_max_2m_24h:C": "t2m_max",
    "t_min_2m_24h:C": "t2m_min",
    "wind_speed_max_10m_24h:kmh": "wind_speed_max",
    "wind_speed_10m:kmh": "wind_speed_mean",
    "wind_gusts_10m_24h:kmh": "wind_gust_p95",
    "precip_24h:mm": "precip_daily",
    "relative_humidity_max_2m_24h:p": "rh_max",
}
DEFAULT_TIMEOUT = float(os.getenv("METEOMATICS_TIMEOUT", "15"))


class MeteomaticsAuthError(RuntimeError):
    pass


def _credentials() -> Tuple[str, str]:
    user = os.getenv("METEOMATICS_USERNAME")
    password = os.getenv("METEOMATICS_PASSWORD")
    if not user or not password:
        raise MeteomaticsAuthError(
            "METEOMATICS_USERNAME and METEOMATICS_PASSWORD environment variables are required"
        )
    return user, password


def parse_target_day(value: str) -> Tuple[int, int]:
    parts = value.split("-")
    if len(parts) == 3:
        return int(parts[1]), int(parts[2])
    return int(parts[0]), int(parts[1])


def daterange_around(month: int, day: int, years: int, window: int) -> Tuple[str, str]:
    today = date.today()
    end_year = today.year - 1
    start_year = end_year - (years - 1)
    center_day = min(day, 28)
    start = date(start_year, month, center_day) - timedelta(days=window)
    end = date(end_year, month, center_day) + timedelta(days=window)
    return start.isoformat(), end.isoformat()


def _build_url(start_iso: str, end_iso: str, lat: float, lon: float) -> str:
    params = ",".join(PARAMETERS.keys())
    start_stamp = f"{start_iso}T00:00:00Z"
    end_stamp = f"{end_iso}T00:00:00Z"
    return (
        f"{BASE_URL}/{start_stamp}--{end_stamp}:PT24H/"
        f"{params}/{lat:.4f},{lon:.4f}/json"
    )


def _to_float(value: Any) -> float | None:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def fetch_daily_series(lat: float, lon: float, start_iso: str, end_iso: str) -> List[Dict[str, Any]]:
    user, password = _credentials()
    url = _build_url(start_iso, end_iso, lat, lon)
    response = httpx.get(url, auth=(user, password), timeout=DEFAULT_TIMEOUT)
    if response.status_code == 401:
        raise MeteomaticsAuthError("Meteomatics authentication failed (401)")
    if response.status_code >= 400:
        raise RuntimeError(
            f"Meteomatics request failed ({response.status_code}): {response.text[:200]}"
        )

    payload = response.json()
    rows: Dict[str, Dict[str, Any]] = {}

    for entry in payload.get("data", []):
        parameter = entry.get("parameter")
        field = PARAMETERS.get(parameter)
        if field is None:
            continue
        for coordinate in entry.get("coordinates", []):
            for item in coordinate.get("dates", []):
                date_iso = item.get("date")
                if not date_iso:
                    continue
                day_key = date_iso[:10]
                rows.setdefault(day_key, {})[field] = _to_float(item.get("value"))

    sorted_days = sorted(rows.keys())
    result: List[Dict[str, Any]] = []
    for day in sorted_days:
        raw = rows[day]
        record: Dict[str, Any] = {"date": day}
        for field in [
            "t2m_max",
            "t2m_min",
            "wind_speed_max",
            "wind_speed_mean",
            "wind_gust_p95",
            "precip_daily",
            "rh_max",
        ]:
            if field in raw and raw[field] is not None:
                record[field] = round(float(raw[field]), 2)

        # Provide defaults for optional keys expected downstream
        if "precip_rate_max" not in record:
            record["precip_rate_max"] = None

        temp_max = record.get("t2m_max")
        temp_min = record.get("t2m_min")
        rh_max = record.get("rh_max")
        wind_speed = record.get("wind_speed_max") or record.get("wind_speed_mean")

        hi = compute_heat_index(temp_max, rh_max)
        if hi is not None:
            record["hi_max"] = hi

        dew = compute_dew_point(temp_max, rh_max)
        if dew is not None:
            record["dewpoint_max"] = dew

        wc = compute_wind_chill(temp_min, wind_speed)
        if wc is not None:
            record["wc_min"] = wc

        result.append(record)

    return result


def assemble_series_real(
    lat: float,
    lon: float,
    target_month: int,
    target_day: int,
    years: int = 20,
    window: int = 15,
) -> List[Dict[str, Any]]:
    start_iso, end_iso = daterange_around(target_month, target_day, years, window)
    series = fetch_daily_series(lat, lon, start_iso, end_iso)
    if not series:
        raise RuntimeError("Meteomatics devolvió un conjunto vacío de datos")
    return series


__all__ = [
    "assemble_series_real",
    "parse_target_day",
    "daterange_around",
]
