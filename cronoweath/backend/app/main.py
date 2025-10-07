"""FastAPI application entrypoint for Cronoweath backend.

This module wires HTTP endpoints to the data engines (mock or NASA) and
implements the contract described in docs/api-contract.md. It currently focuses
on data retrieval, threshold evaluation, and probability/statistics computation;
future work can plug in predictive formulas without changing the HTTP surface.
"""
from __future__ import annotations

import json
import os
import uuid
from datetime import date
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple

import numpy as np
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse

from .models import (
    ErrorResponse,
    QueryRequest,
    QueryResponse,
    SampleInfo,
    Years,
)
from .storage import STORE
from .utils import default_units, now_iso, timeseries_to_csv

# ---------------------------------------------------------------------------
# Configuration & engine selection
# ---------------------------------------------------------------------------

# Resolve thresholds.json robustly (supports monorepo and env override)
_env_thresholds = os.getenv("THRESHOLDS_PATH")
_CONFIG_PATH = None
if _env_thresholds:
    env_path = Path(_env_thresholds)
    if env_path.is_file():
        _CONFIG_PATH = env_path

if _CONFIG_PATH is None:
    here = Path(__file__).resolve()
    parents = list(here.parents)
    # Try a handful of ancestor levels, checking both ./thresholds.json
    # and ./src/config/thresholds.json at each level.
    for idx in range(min(len(parents), 6)):
        base = parents[idx]
        for rel in [
            ("thresholds.json",),
            ("src", "config", "thresholds.json"),
        ]:
            candidate = base.joinpath(*rel)
            if candidate.is_file():
                _CONFIG_PATH = candidate
                break
        if _CONFIG_PATH is not None:
            break

if _CONFIG_PATH is None:  # pragma: no cover - config must exist for app to boot
    raise RuntimeError(
        "thresholds.json not found. Set THRESHOLDS_PATH or place it under src/config/."
    )

with _CONFIG_PATH.open("r", encoding="utf-8") as fh:
    CONF = json.load(fh)

# Choose data engine (mock by default for development)
_ENGINE_KIND = os.getenv("CRONOWEATH_ENGINE", "mock").lower()
if _ENGINE_KIND == "nasa":
    from . import nasa_engine as data_engine
    DATASET_HINTS = {
        "hot": ["MERRA-2"],
        "cold": ["MERRA-2"],
        "windy": ["MERRA-2"],
        "wet": ["GPM IMERG"],
        "muggy": ["MERRA-2"],
    }
elif _ENGINE_KIND == "meteomatics":
    from . import meteomatics_engine as data_engine
    DATASET_HINTS = {
        "hot": ["Meteomatics API"],
        "cold": ["Meteomatics API"],
        "windy": ["Meteomatics API"],
        "wet": ["Meteomatics API"],
        "muggy": ["Meteomatics API"],
    }
else:
    _ENGINE_KIND = "mock"
    from . import mock_engine as data_engine
    DATASET_HINTS = {
        "hot": ["Synthetic dataset"],
        "cold": ["Synthetic dataset"],
        "windy": ["Synthetic dataset"],
        "wet": ["Synthetic dataset"],
        "muggy": ["Synthetic dataset"],
    }


# ---------------------------------------------------------------------------
# FastAPI initialisation
# ---------------------------------------------------------------------------

app = FastAPI(title="Cronoweath Probability API", version="v1")
# CORS configuration
_origins_raw = os.getenv("FRONTEND_ORIGINS", "http://localhost:5173,https://cronoweath.wiki,https://www.cronoweath.wiki").split(",")
_origins = [origin.strip() for origin in _origins_raw if origin.strip()] or ["*"]
if _origins == ["*"]:
    app.add_middleware(
        CORSMiddleware,
        allow_origin_regex=".*",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
else:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )



# ---------------------------------------------------------------------------
# Helper functions
# ---------------------------------------------------------------------------

def _resolve_thresholds(condition: str, overrides: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    base = CONF["conditions"][condition]["thresholds"].copy()
    if overrides:
        for key, value in overrides.items():
            if key in base:
                base[key] = value
    return base


def _resolve_logic(req_logic: str, condition: str) -> str:
    conf_logic = CONF["conditions"][condition].get("logic", "ANY")
    return req_logic or conf_logic


def _choose_metric(condition: str) -> Iterable[str]:
    mapping = {
        "hot": ["t2m_max", "hi_max"],
        "cold": ["t2m_min", "wc_min"],
        "windy": ["wind_speed_max", "wind_gust_p95"],
        "wet": ["precip_daily", "precip_rate_max"],
        "muggy": ["hi_max"],
    }
    return mapping.get(condition, [])


def _evaluate_row(row: Dict[str, Any], condition: str, thr: Dict[str, Any], logic: str) -> Tuple[bool, bool]:
    checks: List[bool] = []

    def has(field: str) -> Optional[float]:
        value = row.get(field)
        return None if value is None else float(value)

    if condition == "hot":
        t_lim = thr.get("T_min")
        if t_lim is not None and (val := has("t2m_max")) is not None:
            checks.append(val >= float(t_lim))
        hi_lim = thr.get("HI_min")
        if hi_lim is not None and (val := has("hi_max")) is not None:
            checks.append(val >= float(hi_lim))

    elif condition == "cold":
        t_lim = thr.get("T_max")
        if t_lim is not None and (val := has("t2m_min")) is not None:
            checks.append(val <= float(t_lim))
        wc_lim = thr.get("WC_max")
        if wc_lim is not None and (val := has("wc_min")) is not None:
            checks.append(val <= float(wc_lim))

    elif condition == "windy":
        v_lim = thr.get("V_min")
        if v_lim is not None and (val := has("wind_speed_max")) is not None:
            checks.append(val >= float(v_lim))
        g_lim = thr.get("gust_min")
        if g_lim is not None and (val := has("wind_gust_p95")) is not None:
            checks.append(val >= float(g_lim))

    elif condition == "wet":
        p_lim = thr.get("P_daily")
        if p_lim is not None and (val := has("precip_daily")) is not None:
            checks.append(val >= float(p_lim))
        r_lim = thr.get("P_rate")
        if r_lim is not None and (val := has("precip_rate_max")) is not None:
            checks.append(val >= float(r_lim))

    elif condition == "muggy":
        hi_lim = thr.get("HI_min")
        if hi_lim is not None and (val := has("hi_max")) is not None:
            checks.append(val >= float(hi_lim))
        td_lim = thr.get("Td_min")
        if td_lim is not None and (val := has("dewpoint_max")) is not None:
            checks.append(val >= float(td_lim))

    if not checks:
        return False, False
    return (any(checks) if logic == "ANY" else all(checks)), True


def _compute_stats(values: List[float]) -> Optional[Dict[str, float]]:
    if not values:
        return None
    arr = np.array(values, dtype=float)
    arr = arr[~np.isnan(arr)]
    if arr.size == 0:
        return None
    return {
        "mean": round(float(np.nanmean(arr)), 1),
        "p10": round(float(np.nanpercentile(arr, 10)), 1),
        "p50": round(float(np.nanpercentile(arr, 50)), 1),
        "p90": round(float(np.nanpercentile(arr, 90)), 1),
    }


def _year_metadata(years: int, mode: str) -> Years:
    if mode == "lastN":
        end_year = date.today().year - 1
        start_year = end_year - (years - 1)
        range_label = f"{start_year}-{end_year}"
        return Years(mode=mode, range=range_label, n_years=years)
    return Years(mode=mode)


def _coverage(n_rows: int, years: int, window: int) -> float:
    theoretical = years * (2 * window + 1)
    if theoretical <= 0:
        return 0.0
    return round(100.0 * n_rows / theoretical, 1)


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@app.get("/health")
def health() -> Dict[str, Any]:
    return {
        "status": "ok",
        "engine": _ENGINE_KIND,
        "version": app.version,
        "time_utc": now_iso(),
    }


@app.get("/conditions")
def conditions() -> Dict[str, Any]:
    return {
        "window_days": CONF.get("window_days"),
        "years_mode": CONF.get("years_mode"),
        "lastN_years": CONF.get("lastN_years"),
        "min_sample_size": CONF.get("min_sample_size"),
        "units_ui": CONF.get("units_ui", "toggle"),
        "conditions": CONF.get("conditions", {}),
    }


@app.post("/query", response_model=QueryResponse)
def query(req: QueryRequest):
    condition_conf = CONF["conditions"][req.condition]
    thresholds = _resolve_thresholds(req.condition, req.thresholds)
    logic = _resolve_logic(req.logic, req.condition)

    try:
        target_month, target_day = data_engine.parse_target_day(req.target_day)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Invalid target_day: {exc}") from exc

    years = req.lastN_years if req.years_mode == "lastN" else CONF.get("lastN_years", 20)

    try:
        if hasattr(data_engine, "assemble_series_real"):
            timeseries = data_engine.assemble_series_real(
                req.location.lat,
                req.location.lon,
                target_month,
                target_day,
                years=years,
                window=req.window_days,
            )
        else:
            timeseries = data_engine.assemble_series(
                target_month,
                target_day,
                years=years,
                window=req.window_days,
            )
    except Exception as exc:  # pragma: no cover - depends on external services
        raise HTTPException(status_code=400, detail=f"Data engine error: {exc}") from exc

    evaluated_days = 0
    exceed_count = 0
    metric_values: List[float] = []
    metrics_to_check = list(_choose_metric(req.condition))

    for row in timeseries:
        exceeds, considered = _evaluate_row(row, req.condition, thresholds, logic)
        if considered:
            evaluated_days += 1
            if exceeds:
                exceed_count += 1
            row["exceed"] = exceeds
        else:
            row["exceed"] = None

        for metric_field in metrics_to_check:
            value = row.get(metric_field)
            if value is not None:
                metric_values.append(float(value))

    if evaluated_days == 0:
        raise HTTPException(
            status_code=400,
            detail="Timeseries does not contain data for the requested condition",
        )

    if evaluated_days < CONF.get("min_sample_size", 300):
        error = ErrorResponse(
            status="insufficient_sample",
            message="Not enough historical data to compute probability",
            sample=SampleInfo(n_days=evaluated_days),
        )
        return JSONResponse(status_code=200, content=error.model_dump())

    probability_pct = round(100.0 * exceed_count / evaluated_days, 1)
    stats = _compute_stats(metric_values)

    query_id = "q_" + uuid.uuid4().hex[:10]
    years_meta = _year_metadata(years, req.years_mode)
    units = default_units(req.units)

    response_payload = QueryResponse(
        query_id=query_id,
        condition=req.condition,
        logic=logic,
        location=req.location,
        target_day=f"{target_month:02d}-{target_day:02d}",
        window_days=req.window_days,
        years=years_meta,
        thresholds_resolved=thresholds,
        probability_pct=probability_pct,
        stats=stats,
        sample=SampleInfo(
            n_days=evaluated_days,
            coverage_pct=_coverage(evaluated_days, years, req.window_days),
        ),
        dataset_used=DATASET_HINTS.get(req.condition, []),
        notes=[
            f"engine={_ENGINE_KIND}",
            f"window+/-{req.window_days}",
            f"{years} years",
        ],
        units=units,
        generated_at=now_iso(),
        timeseries=timeseries if req.include_timeseries else None,
    ).model_dump()

    STORE[query_id] = {
        **response_payload,
        "timeseries": timeseries,  # ensure stored even if not returned
    }

    if req.response_fields:
        keep = {"query_id", "condition", *req.response_fields}
        response_payload = {k: v for k, v in response_payload.items() if k in keep}

    return response_payload


@app.get("/download")
def download(
    query_id: str = Query(..., description="Identifier returned by /query"),
    format: str = Query("csv", pattern="^(csv|json)$"),
    fields: str = Query(
        "all",
        pattern="^(all|result|timeseries)$",
        description="Portion of the cached payload to download",
    ),
):
    payload = STORE.get(query_id)
    if not payload:
        raise HTTPException(status_code=404, detail="query_id not found")

    if format == "json":
        if fields == "result":
            data = {k: v for k, v in payload.items() if k != "timeseries"}
        elif fields == "timeseries":
            if payload.get("timeseries") is None:
                raise HTTPException(
                    status_code=400,
                    detail="timeseries not available for this query",
                )
            data = {
                "query_id": payload["query_id"],
                "timeseries": payload["timeseries"],
            }
        else:  # all
            data = payload
        return JSONResponse(content=data)

    # CSV export requires timeseries data
    if payload.get("timeseries") is None:
        raise HTTPException(
            status_code=400,
            detail="timeseries not available for CSV download",
        )

    meta = {
        "query_id": payload["query_id"],
        "condition": payload["condition"],
        "location": f"{payload['location']['lat']},{payload['location']['lon']}",
        "generated_at": payload["generated_at"],
    }
    csv_bytes = timeseries_to_csv(meta, payload["timeseries"])
    filename = f"{payload['query_id']}.csv"
    return StreamingResponse(
        iter([csv_bytes]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


__all__ = ["app"]


