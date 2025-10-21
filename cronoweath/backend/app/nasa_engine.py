# backend/app/nasa_engine.py
from __future__ import annotations

from typing import Any, Dict, List, Tuple
from datetime import date, timedelta

import numpy as np
import xarray as xr
import earthaccess as ea
from pydap.cas.urs import setup_session as urs_setup_session
import netrc as _netrc
import re
import os
import time
import logging
import functools

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


def _prefer_server(url: str) -> str:
    """Map generic GES DISC host to stable collection-specific hosts.

    Some links from CMR use the generic host `data.gesdisc.earthdata.nasa.gov`.
    In practice, MERRA-2 tends to live under `goldsmr4/5`, and IMERG under
    `gpm1/2`. Rewriting to those helps avoid intermittent I/O issues.
    """
    try:
        if "MERRA2/" in url:
            return re.sub(r"https://[^/]+/", "https://goldsmr4.gesdisc.eosdis.nasa.gov/", url)
        if "GPM_L3" in url or "IMERG" in url:
            return re.sub(r"https://[^/]+/", "https://gpm1.gesdisc.eosdis.nasa.gov/", url)
    except Exception:
        pass
    return url


def _host_alternatives(url: str) -> List[str]:
    """Return a list of host alternatives for robustness (goldsmr4↔goldsmr5, gpm1↔gpm2)."""
    alts: List[str] = []
    base = _prefer_server(url)
    alts.append(base)
    try:
        if "goldsmr4" in base:
            alts.append(base.replace("goldsmr4", "goldsmr5"))
        elif "goldsmr5" in base:
            alts.append(base.replace("goldsmr5", "goldsmr4"))
        if "gpm1" in base:
            alts.append(base.replace("gpm1", "gpm2"))
        elif "gpm2" in base:
            alts.append(base.replace("gpm2", "gpm1"))
    except Exception:
        pass
    # Ensure uniqueness preserving order
    seen = set()
    ordered: List[str] = []
    for u in alts:
        if u not in seen:
            ordered.append(u)
            seen.add(u)
    return ordered


def _dap_variants(url: str) -> List[str]:
    """Generate OPeNDAP endpoint variants accepted by Hyrax/netCDF.

    Prefer explicit DAP endpoints (.dods/.dap). We'll keep raw url only as
    very last fallback elsewhere.
    """
    if url.endswith((".dods", ".dap")):
        return [url]
    return [url + ".dods", url + ".dap"]


def _to_dds(endpoint: str) -> str:
    if endpoint.endswith(".dods"):
        return endpoint[:-5] + ".dds"
    if endpoint.endswith(".dap"):
        return endpoint[:-4] + ".dds"
    if endpoint.endswith(".html"):
        return endpoint[:-5] + ".dds"
    if endpoint.endswith(".dds"):
        return endpoint
    return endpoint + ".dds"


def _open_opendap_dataset(url: str) -> xr.Dataset:
    """Attempt to open an OPeNDAP dataset trying host and endpoint variants with URS session.

    Adds detailed logging and short, bounded timeouts to avoid edge timeouts (502).
    """
    logger = logging.getLogger("cronoweath.nasa")
    timeout_s = float(os.getenv("NASA_DAP_TIMEOUT", "12"))  # per attempt
    max_total_s = float(os.getenv("NASA_DAP_TOTAL", "22"))   # hard stop to avoid 20s edge limit
    t0 = time.monotonic()
    nrc = _netrc.netrc()
    auth = nrc.authenticators("urs.earthdata.nasa.gov")
    if not auth:
        raise RuntimeError("Credenciales URS no encontradas en ~/.netrc")
    username, _, password = auth

    last_error: Exception | None = None
    for host_url in _host_alternatives(url):
        for endpoint in _dap_variants(host_url):
            try:
                session = urs_setup_session(username, password, check_url=endpoint)
                # Inject per-request timeout into the session
                session.request = functools.partial(session.request, timeout=timeout_s)  # type: ignore[attr-defined]
                # Quick probe on .dds to avoid hanging inside pydap/xarray
                probe = _to_dds(endpoint)
                logger.info("OPeNDAP probe=%s timeout=%ss", probe, timeout_s)
                resp = session.get(probe)
                if getattr(resp, "status_code", 200) >= 400:
                    raise RuntimeError(f"probe failed code={getattr(resp,'status_code',None)} url={probe}")
                logger.info("OPeNDAP try endpoint=%s timeout=%ss", endpoint, timeout_s)
                ds = xr.open_dataset(endpoint, engine="pydap", backend_kwargs={"session": session})
                logger.info("OPeNDAP success endpoint=%s took=%.2fs", endpoint, time.monotonic() - t0)
                return ds
            except Exception as exc:
                last_error = exc
                logger.warning("OPeNDAP fail endpoint=%s err=%s", endpoint, exc)
                if (time.monotonic() - t0) > max_total_s:
                    logger.error("OPeNDAP abort after %.2fs (edge timeout guard)", time.monotonic() - t0)
                    raise last_error
                continue
    # Final fallback: try direct open (may work if server allows)
    try:
        endpoint = _prefer_server(url)
        logger.info("OPeNDAP fallback open raw url=%s", endpoint)
        return xr.open_dataset(endpoint)
    except Exception as exc:
        logger.error("OPeNDAP fallback failed url=%s err=%s", endpoint, exc)
        raise exc if last_error is None else last_error


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
        ds = _open_opendap_dataset(url)
        # Recorta por tiempo lo antes posible para reducir I/O
        try:
            ds = ds.sel(time=slice(start, end))
        except Exception:
            pass
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

        try:
            ds.close()
        except Exception:
            pass

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
        ds = _open_opendap_dataset(url)
        # Recorta por tiempo lo antes posible
        try:
            ds = ds.sel(time=slice(start, end))
        except Exception:
            pass
        ds = select_point(ds, lat, lon)
        var = "precipitation" if "precipitation" in ds.data_vars else "precipitationCal"
        pr = ds[var]
        if not np.issubdtype(ds["time"].dtype, np.datetime64):
            ds["time"] = xr.decode_cf(ds).time
        series.append(pr)
        try:
            ds.close()
        except Exception:
            pass

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
    condition: str | None = None,
) -> List[Dict[str, Any]]:
    start_iso, end_iso = daterange_around(target_month, target_day, years, window)

    merra_data = merra2_daily_point(lat, lon, start_iso, end_iso)
    need_precip = (condition == "wet")
    imerg_data = None
    if need_precip:
        imerg_data = imerg_daily_point(lat, lon, start_iso, end_iso)

    pieces: List[xr.DataArray] = []
    for name, data_array in merra_data.items():
        if data_array is not None:
            pieces.append(data_array.rename(name))
    if imerg_data is not None:
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
