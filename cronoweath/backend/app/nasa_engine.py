# backend/app/nasa_engine.py
from __future__ import annotations

from typing import Any, Dict, List, Tuple
from datetime import date, timedelta

import numpy as np
import xarray as xr
import earthaccess as ea

from .formulas import (
    compute_dew_point,
    compute_heat_index,
    compute_wind_chill,
)


# ---------------------------------------------------------------------------
# Date utilities
# ---------------------------------------------------------------------------

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


# ---------------------------------------------------------------------------
# Earthdata helpers
# ---------------------------------------------------------------------------

def edl_login() -> ea.Auth:
    return ea.login(strategy="netrc")


def cmr_search(short_name: str, start: str, end: str) -> List[ea.DataGranule]:
    auth = edl_login()
    results = ea.search_data(
        short_name=short_name,
        temporal=(start, end),
        cloud_hosted=False,
        count=-1,
    )
    return list(results)


def _to_opendap_url(link: str) -> str:
    if "/opendap/" in link:
        return link
    return link.replace("/data/", "/opendap/")


def _extract_links(granule: Any) -> List[str]:
    """Try multiple earthaccess APIs to extract downloadable links from a granule."""
    # Prefer newer API first
    try:
        if hasattr(ea, "get_data_links"):
            found = ea.get_data_links([granule], link_type="https")
            if found:
                return list(found)
    except Exception:
        pass

    # Fallback to older helper
    try:
        if hasattr(ea, "data_links"):
            found = ea.data_links([granule], link_type="https")
            if found:
                return list(found)
    except Exception:
        pass

    # Try object methods/attributes present in some versions
    try:
        if hasattr(granule, "data_links") and callable(getattr(granule, "data_links")):
            found = granule.data_links()
            if found:
                return list(found)
    except Exception:
        pass

    try:
        raw = getattr(granule, "links", None)
        links: List[str] = []
        if isinstance(raw, (list, tuple)):
            for item in raw:
                href = item.get("href") if isinstance(item, dict) else None
                if href:
                    links.append(href)
        return links
    except Exception:
        return []


def granules_to_opendap_urls(granules: List[ea.DataGranule]) -> List[str]:
    urls: List[str] = []
    for granule in granules:
        links = _extract_links(granule)
        for link in links:
            try:
                if isinstance(link, bytes):
                    link = link.decode("utf-8", errors="ignore")
                if not isinstance(link, str):
                    continue
                if link.endswith(".nc4") and ("/data/" in link or "/opendap/" in link):
                    urls.append(_to_opendap_url(link))
            except Exception:
                continue
    return sorted(set(urls))


# ---------------------------------------------------------------------------
# Spatial helpers
# ---------------------------------------------------------------------------

def to_360(lon: float) -> float:
    return lon if lon >= 0 else lon + 360.0


def select_point(ds: xr.Dataset, lat: float, lon: float) -> xr.Dataset:
    lon_var = "lon" if "lon" in ds.coords else "longitude"
    lat_var = "lat" if "lat" in ds.coords else "latitude"
    if ds[lon_var].max().item() > 180 and lon < 0:
        lon = to_360(lon)
    return ds.sel({lat_var: lat, lon_var: lon}, method="nearest")


# ---------------------------------------------------------------------------
# Unit conversions and aggregations
# ---------------------------------------------------------------------------

def K_to_C(x: xr.DataArray) -> xr.DataArray:
    return x - 273.15


def ms_to_kmh(x: xr.DataArray) -> xr.DataArray:
    return x * 3.6


def daily_agg_max(x: xr.DataArray) -> xr.DataArray:
    return x.resample(time="1D").max()


def daily_agg_min(x: xr.DataArray) -> xr.DataArray:
    return x.resample(time="1D").min()


def daily_agg_sum(x: xr.DataArray) -> xr.DataArray:
    return x.resample(time="1D").sum()


def wind_speed(u10: xr.DataArray, v10: xr.DataArray) -> xr.DataArray:
    return xr.apply_ufunc(lambda u, v: np.sqrt(u ** 2 + v ** 2), u10, v10)


# ---------------------------------------------------------------------------
# Dataset readers
# ---------------------------------------------------------------------------

def merra2_daily_point(lat: float, lon: float, start: str, end: str) -> Dict[str, xr.DataArray]:
    granules = cmr_search("M2T1NXSLV", start, end)
    urls = granules_to_opendap_urls(granules)
    if not urls:
        raise RuntimeError("No se encontraron granulos MERRA-2 en el rango solicitado.")

    tmax_list: List[xr.DataArray] = []
    tmin_list: List[xr.DataArray] = []
    wmax_list: List[xr.DataArray] = []
    gust95_list: List[xr.DataArray] = []
    rhmax_list: List[xr.DataArray] = []

    for url in urls:
        ds = xr.open_dataset(url)
        ds = select_point(ds, lat, lon)

        T2M = ds["T2M"]
        U10M = ds.get("U10M")
        V10M = ds.get("V10M")
        RH2M = ds.get("RH2M")

        if not np.issubdtype(ds["time"].dtype, np.datetime64):
            ds["time"] = xr.decode_cf(ds).time

        tmax_list.append(daily_agg_max(K_to_C(T2M)))
        tmin_list.append(daily_agg_min(K_to_C(T2M)))

        if U10M is not None and V10M is not None:
            wspd = wind_speed(U10M, V10M)
            wspd_kmh = ms_to_kmh(wspd)
            wmax_list.append(daily_agg_max(wspd_kmh))
            gust95_list.append(wspd_kmh.resample(time="1D").reduce(np.nanpercentile, q=95))

        if RH2M is not None:
            rhmax_list.append(daily_agg_max(RH2M))

        ds.close()

    def _combine(items: List[xr.DataArray]) -> xr.DataArray | None:
        return xr.concat(items, dim="time").sortby("time") if items else None

    return {
        "t2m_max": _combine(tmax_list),
        "t2m_min": _combine(tmin_list),
        "wind_speed_max": _combine(wmax_list),
        "wind_gust_p95": _combine(gust95_list),
        "rh_max": _combine(rhmax_list),
    }


def imerg_daily_point(lat: float, lon: float, start: str, end: str) -> xr.DataArray:
    granules = cmr_search("GPM_3IMERGDF", start, end)
    urls = granules_to_opendap_urls(granules)
    if not urls:
        raise RuntimeError("No se encontraron granulos IMERG Daily en el rango solicitado.")

    series: List[xr.DataArray] = []
    for url in urls:
        ds = xr.open_dataset(url)
        ds = select_point(ds, lat, lon)
        var = "precipitation" if "precipitation" in ds.data_vars else "precipitationCal"
        pr = ds[var]
        if not np.issubdtype(ds["time"].dtype, np.datetime64):
            ds["time"] = xr.decode_cf(ds).time
        series.append(pr)
        ds.close()

    return xr.concat(series, dim="time").sortby("time")


# ---------------------------------------------------------------------------
# Series assembler
# ---------------------------------------------------------------------------

def assemble_series_real(
    lat: float,
    lon: float,
    target_month: int,
    target_day: int,
    years: int = 20,
    window: int = 15,
) -> List[Dict[str, Any]]:
    start_iso, end_iso = daterange_around(target_month, target_day, years, window)

    merra_data = merra2_daily_point(lat, lon, start_iso, end_iso)
    imerg_data = imerg_daily_point(lat, lon, start_iso, end_iso)

    pieces: List[xr.DataArray] = []
    for name, data_array in merra_data.items():
        if data_array is not None:
            pieces.append(data_array.rename(name))
    pieces.append(imerg_data.rename("precip_daily"))

    ds = xr.merge(pieces).sortby("time")

    rows: List[Dict[str, Any]] = []
    for ts_value in ds["time"].values:
        row: Dict[str, Any] = {"date": np.datetime_as_string(ts_value, unit="D")}
        for var in ds.data_vars:
            value = ds[var].sel(time=ts_value).item()
            if isinstance(value, (np.floating, float, int, np.integer)):
                row[var] = None if np.isnan(value) else round(float(value), 2)

        temp_max = row.get("t2m_max")
        rh_max = row.get("rh_max")
        temp_min = row.get("t2m_min")
        wind_max = row.get("wind_speed_max")

        hi = compute_heat_index(temp_max, rh_max)
        if hi is not None:
            row["hi_max"] = hi

        dew = compute_dew_point(temp_max, rh_max)
        if dew is not None:
            row["dewpoint_max"] = dew

        wc = compute_wind_chill(temp_min, wind_max)
        if wc is not None:
            row["wc_min"] = wc

        rows.append(row)

    return rows
