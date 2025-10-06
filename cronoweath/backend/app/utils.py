import io
import csv
from typing import Any, Dict, List
from datetime import datetime, timezone


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def default_units(units_ui: str = "SI") -> Dict[str, str]:
    if units_ui == "Imperial":
        return {"temp": "degF", "precip": "in", "wind": "mph", "prob": "%"}
    return {"temp": "degC", "precip": "mm", "wind": "km/h", "prob": "%"}


def timeseries_to_csv(meta: Dict[str, Any], ts: List[Dict[str, Any]]) -> bytes:
    buffer = io.StringIO()
    for key, value in meta.items():
        buffer.write(f"# {key}: {value}\n")

    headers = [
        "date",
        "t2m_max",
        "hi_max",
        "t2m_min",
        "wc_min",
        "wind_speed_max",
        "wind_gust_p95",
        "precip_daily",
        "precip_rate_max",
        "exceed",
    ]

    writer = csv.DictWriter(buffer, fieldnames=headers)
    writer.writeheader()
    for row in ts:
        writer.writerow({header: row.get(header, "") for header in headers})

    return buffer.getvalue().encode("utf-8")
