# api-contract.md — Probabilidad de Clima (MVP)

Contrato de API para el MVP descrito en `vision.md`, `variables.md`, `datasets.md` y `content.md`.

* **Base URL (dev):** `http://localhost:8000`
* **Versión:** `v1`
* **Auth:** No requiere autenticación (MVP). No se manejan PII.
* **Formato:** JSON por defecto; CSV sólo en descargas.
* **Unidades:** Interno en **SI**. La API puede devolver UI en **SI** o **Imperial** (parámetro `units`).
* **Límites (sugeridos):** 60 req/min por IP (429 si excede).

---

## 1) GET `/health`

**Descripción:** Verifica disponibilidad del servicio.

**Respuesta 200**

```json
{
  "status": "ok",
  "version": "v1",
  "time_utc": "2025-10-05T04:20:00Z"
}
```

**Códigos:** 200, 500

---

## 2) GET `/conditions`

**Descripción:** Lista condiciones soportadas y sus umbrales por defecto (derivados de `thresholds.json`).

**Respuesta 200**

```json
{
  "window_days": 15,
  "years_mode": "lastN",
  "lastN_years": 20,
  "min_sample_size": 300,
  "units_ui": "toggle",
  "conditions": {
    "hot": {
      "label": "Muy caliente",
      "logic": "ANY",
      "agg": "max",
      "thresholds": { "T_min": 32, "HI_min": null }
    },
    "cold": {
      "label": "Muy frío",
      "logic": "ANY",
      "agg": "min",
      "thresholds": { "T_max": 0, "WC_max": -5 }
    },
    "windy": {
      "label": "Muy ventoso",
      "logic": "ANY",
      "agg": "max",
      "thresholds": { "V_min": 50, "gust_min": 70 }
    },
    "wet": {
      "label": "Muy mojado",
      "logic": "ANY",
      "agg": "sum",
      "thresholds": { "P_daily": 25, "P_rate": 7.6 }
    },
    "muggy": {
      "label": "Muy incómodo",
      "logic": "ANY",
      "agg": "max",
      "thresholds": { "HI_min": 32, "Td_min": 21 }
    }
  }
}
```

**Códigos:** 200, 500

---

## 3) POST `/query`

**Descripción:** Calcula la probabilidad histórica para una **condición** dada, en un **lugar** y **fecha**.

**Body (JSON)**

```json
{
  "location": { "lat": 19.24, "lon": -103.72 },
  "target_day": "05-15", 
  "condition": "hot", 
  "logic": "ANY", 
  "units": "SI", 
  "thresholds": { "T_min": 32, "HI_min": null },
  "window_days": 15,
  "years_mode": "lastN",
  "lastN_years": 20,
  "outlier_clip": [1, 99],
  "gust_proxy_percentile": 95,
  "include_timeseries": false,
  "response_fields": ["probability_pct","stats","sample","dataset_used"]
}
```

**Notas de validación**

* `location`: obligatorio. Estructuras válidas:

  * `{ lat: number, lon: number }` (recomendado)
  * `{ place_name: string }` (si hay geocoding en backend; opcional en MVP)
* `target_day`: `"MM-DD"` o `"YYYY-MM-DD"` (la API tomará **día del año**; ignorará el año si viene completo).
* `condition`: uno de `hot|cold|windy|wet|muggy`.
* `logic`: `ANY|ALL` (por defecto `ANY`).
* `units`: `SI|Imperial` (por defecto `SI`).
* `thresholds`: opcional; si falta, usa `thresholds.json`. Claves desconocidas se ignoran.
* `window_days`: entero 5–31 (por defecto 15).
* `years_mode`: `lastN|all` (por defecto `lastN` con `lastN_years=20`).
* `min_sample_size`: viene del servidor (300). Si no se alcanza, se responde error de datos insuficientes (véase abajo) o `probability_pct=null` con `status="insufficient_sample"`.

**Respuesta 200**

```json
{
  "query_id": "q_01HF5R...",
  "condition": "hot",
  "logic": "ANY",
  "location": { "lat": 19.24, "lon": -103.72 },
  "target_day": "05-15",
  "window_days": 15,
  "years": { "mode": "lastN", "range": "2005–2024", "n_years": 20 },
  "thresholds_resolved": { "T_min": 32, "HI_min": null },
  "probability_pct": 63.2,
  "stats": { "mean": 30.4, "p10": 24.8, "p50": 31.1, "p90": 36.9 },
  "sample": { "n_days": 612, "coverage_pct": 98.7 },
  "dataset_used": ["MERRA-2"],
  "notes": ["max daily T2M", "window ±15 days", "last 20 years"],
  "units": { "temp": "°C", "precip": "mm", "wind": "km/h", "prob": "%" },
  "generated_at": "2025-10-05T04:20:30Z"
}
```

**Respuesta 200 (con series opcional)**

```json
{
  "...": "...",
  "timeseries": [
    { "date": "2010-05-10", "t2m_max": 33.1, "exceed": true },
    { "date": "2010-05-11", "t2m_max": 31.4, "exceed": false }
  ]
}
```

**Errores**

* `400 Bad Request`: parámetros inválidos (por ejemplo, lat/lon fuera de rango, condición desconocida).
* `422 Unprocessable Entity`: tipos inválidos o JSON mal formado.
* `429 Too Many Requests`: rate limit.
* `503 Service Unavailable`: origen de datos no disponible.
* `200 con status de negocio` (opción A):

```json
{
  "status": "insufficient_sample",
  "message": "No hay suficientes datos para calcular la probabilidad",
  "sample": { "n_days": 124 }
}
```

---

## 4) GET `/download`

**Descripción:** Descarga el resultado de una consulta anterior en **CSV** o **JSON**.

**Query params**

* `query_id` (recomendado): ID retornado por `/query`.
* `format`: `csv|json` (por defecto `csv`).
* `fields`: `result|timeseries|all` (por defecto `all`).

**Respuestas**

* **CSV (`text/csv`)** — encabezado con metadatos como comentarios `#` y luego filas.

  * **Metadatos**: condition, logic, lat, lon, target_day, window_days, years_range, thresholds, units, dataset_used, generated_at.
  * **Columnas sugeridas (genéricas)**: `date, t2m_max, hi_max, t2m_min, wc_min, wind_speed_max, wind_gust_p95, precip_daily, precip_rate_max, exceed` (las no aplicables pueden venir vacías).
* **JSON (`application/json`)** — objeto igual al de `/query`, con `timeseries` si se pidió `fields=timeseries|all`.

**Códigos:** 200, 400, 404 (query_id desconocido), 500

---

## 5) Errores y formato estándar

**Objeto de error**

```json
{
  "error": {
    "code": 400,
    "type": "BadRequest",
    "message": "Latitud fuera de rango (-90 a 90)",
    "details": { "lat": 123.45 }
  }
}
```

**Códigos estándar**: 200, 400, 401, 403, 404, 422, 429, 500, 503.

---

## 6) Semántica de negocio (resumen)

* **Ventana estacional:** ±15 días.
* **Periodo de referencia:** últimos 20 años.
* **Muestra mínima:** 300 días.
* **Lógica por condición:** `ANY` por defecto, `ALL` opcional.
* **Outliers:** recorte opcional P1–P99.
* **Ráfagas:** `gust_proxy_percentile = 95` si no hay ráfagas.

---

## 7) Esquemas (JSON Schema — resumen)

### 7.1 Request `/query`

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://example.com/schemas/query.request.json",
  "type": "object",
  "required": ["location","target_day","condition"],
  "properties": {
    "location": {
      "oneOf": [
        {
          "type": "object",
          "required": ["lat","lon"],
          "properties": {
            "lat": {"type": "number", "minimum": -90, "maximum": 90},
            "lon": {"type": "number", "minimum": -180, "maximum": 180}
          }
        },
        { "type": "object", "required": ["place_name"], "properties": {"place_name": {"type": "string", "minLength": 2}} }
      ]
    },
    "target_day": {"type": "string", "pattern": "^(\\d{2}-\\d{2}|\\d{4}-\\d{2}-\\d{2})$"},
    "condition": {"type": "string", "enum": ["hot","cold","windy","wet","muggy"]},
    "logic": {"type": "string", "enum": ["ANY","ALL"], "default": "ANY"},
    "units": {"type": "string", "enum": ["SI","Imperial"], "default": "SI"},
    "thresholds": {"type": "object"},
    "window_days": {"type": "integer", "minimum": 5, "maximum": 31, "default": 15},
    "years_mode": {"type": "string", "enum": ["lastN","all"], "default": "lastN"},
    "lastN_years": {"type": "integer", "minimum": 5, "maximum": 60, "default": 20},
    "outlier_clip": {"type": "array", "items": {"type": "integer"}, "minItems": 2, "maxItems": 2},
    "gust_proxy_percentile": {"type": "integer", "minimum": 50, "maximum": 99, "default": 95},
    "include_timeseries": {"type": "boolean", "default": false},
    "response_fields": {"type": "array", "items": {"type": "string"}}
  }
}
```

### 7.2 Response `/query`

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://example.com/schemas/query.response.json",
  "type": "object",
  "required": ["query_id","condition","location","target_day","probability_pct","sample"],
  "properties": {
    "query_id": {"type": "string"},
    "condition": {"type": "string"},
    "logic": {"type": "string"},
    "location": {"type": "object"},
    "target_day": {"type": "string"},
    "window_days": {"type": "integer"},
    "years": {"type": "object"},
    "thresholds_resolved": {"type": "object"},
    "probability_pct": {"type": "number", "minimum": 0, "maximum": 100},
    "stats": {"type": "object"},
    "sample": {"type": "object", "required": ["n_days"]},
    "dataset_used": {"type": "array", "items": {"type": "string"}},
    "notes": {"type": "array", "items": {"type": "string"}},
    "units": {"type": "object"},
    "generated_at": {"type": "string", "format": "date-time"},
    "timeseries": {"type": "array"}
  }
}
```

---

## 8) OpenAPI (extracto mínimo)

```yaml
openapi: 3.1.0
info:
  title: Probabilidad de Clima API
  version: v1
servers:
  - url: http://localhost:8000
paths:
  /health:
    get:
      responses:
        '200': { description: OK }
  /conditions:
    get:
      responses:
        '200': { description: OK }
  /query:
    post:
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/QueryRequest'
      responses:
        '200':
          description: Resultado de probabilidad
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/QueryResponse'
  /download:
    get:
      parameters:
        - in: query
          name: query_id
          schema: { type: string }
        - in: query
          name: format
          schema: { type: string, enum: [csv, json], default: csv }
        - in: query
          name: fields
          schema: { type: string, enum: [result, timeseries, all], default: all }
      responses:
        '200': { description: Archivo descargable }
components:
  schemas:
    QueryRequest: {}
    QueryResponse: {}
```

---

## 9) Notas de implementación

* Backend sugerido: **FastAPI** (pydantic para validación) + módulo de datos (OPeNDAP / requests).
* Cache ligero por `query_id` en memoria o disco (para `/download`).
* Registrar en logs: lat/lon, condición, duración, tamaño de muestra y códigos de error.
* Atribución NASA en metadatos de descarga (dataset, fecha de acceso, URL del subset).

---

## 10) Ejemplos adicionales

### 10.1 `wet` (lluvia diaria)

**Request**

```json
{
  "location": { "lat": -23.55, "lon": -46.63 },
  "target_day": "01-20",
  "condition": "wet",
  "thresholds": { "P_daily": 40 },
  "logic": "ANY",
  "units": "SI"
}
```

**Response (200)**

```json
{
  "query_id": "q_6YZ...",
  "condition": "wet",
  "probability_pct": 41.8,
  "sample": { "n_days": 600 },
  "dataset_used": ["GPM IMERG"],
  "notes": ["sum daily precipitation"],
  "units": { "precip": "mm" }
}
```

### 10.2 `windy` (viento)

**Request**

```json
{
  "location": { "lat": 40.71, "lon": -74.0 },
  "target_day": "09-10",
  "condition": "windy",
  "thresholds": { "V_min": 45, "gust_min": 80 },
  "logic": "ANY"
}
```

**Response (200)**

```json
{
  "query_id": "q_ABCD",
  "condition": "windy",
  "probability_pct": 12.5,
  "sample": { "n_days": 590 },
  "dataset_used": ["MERRA-2"],
  "notes": ["max daily speed", "gust proxy p95"]
}
```
