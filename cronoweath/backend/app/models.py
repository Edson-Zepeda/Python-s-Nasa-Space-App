# backend/app/models.py
from typing import Optional, Literal, List, Dict, Any
from pydantic import BaseModel, Field, field_validator

class Location(BaseModel):
    lat: float
    lon: float

class Years(BaseModel):
    mode: Literal["lastN", "all"]
    range: Optional[str] = None
    n_years: Optional[int] = None

class QueryRequest(BaseModel):
    location: Location
    # "MM-DD" o "YYYY-MM-DD"
    target_day: str = Field(..., description="MM-DD o YYYY-MM-DD")
    condition: Literal["hot", "cold", "windy", "wet", "muggy"]
    logic: Literal["ANY", "ALL"] = "ANY"
    units: Literal["SI", "Imperial"] = "SI"

    # Overrides opcionales de umbrales, p. ej. {"T_min": 32, "HI_min": null}
    thresholds: Optional[Dict[str, Optional[float]]] = None

    # Ventana y periodo
    window_days: int = 15
    years_mode: Literal["lastN", "all"] = "lastN"
    lastN_years: int = 20

    # Opciones extra
    outlier_clip: Optional[List[int]] = [1, 99]
    gust_proxy_percentile: Optional[int] = 95
    include_timeseries: bool = False
    response_fields: Optional[List[str]] = None

    @field_validator("target_day")
    @classmethod
    def validate_day(cls, v: str):
        import re
        if not re.match(r"^\d{2}-\d{2}$|^\d{4}-\d{2}-\d{2}$", v):
            raise ValueError("target_day debe ser 'MM-DD' o 'YYYY-MM-DD'")
        return v

class SampleInfo(BaseModel):
    n_days: int
    coverage_pct: Optional[float] = None

class QueryResponse(BaseModel):
    query_id: str
    condition: str
    logic: str
    location: Location
    target_day: str
    window_days: int
    years: Years
    thresholds_resolved: Dict[str, Optional[float]]
    probability_pct: Optional[float]
    stats: Optional[Dict[str, float]] = None
    sample: SampleInfo
    dataset_used: List[str]
    notes: List[str]
    units: Dict[str, str]
    generated_at: str
    timeseries: Optional[List[Dict[str, Any]]] = None

class ErrorResponse(BaseModel):
    status: Literal["insufficient_sample", "error"]
    message: str
    sample: Optional[SampleInfo] = None
