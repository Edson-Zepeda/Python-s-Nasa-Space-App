# variables.md — Definiciones y umbrales (MVP)

> Documento base para cálculo de **probabilidades históricas** por **lugar** y **día del año**. Define **condiciones**, **variables fuente**, **umbrales por defecto**, agregaciones diarias, lógica de evaluación y opciones de UI. **No es pronóstico**.

---

## 1) Condiciones del MVP (con más opciones de umbral por condición)

| key     | Nombre en UI            | Variable(s) base                                     | Dataset sugerido | Agregación diaria             | Umbrales por defecto (SI)               |  Lógica | Notas                                                                                    |
| ------- | ----------------------- | ---------------------------------------------------- | ---------------- | ----------------------------- | --------------------------------------- | :-----: | ---------------------------------------------------------------------------------------- |
| `hot`   | Muy caliente            | Temperatura 2 m (**T2M**); opcional **HI**           | MERRA‑2          | **máxima diaria**             | `T_min = 32 °C`, `HI_min = null`        | **ANY** | Por defecto usa T; si `HI_min` ≠ null, se cumple si **T ≥ T_min** **o** **HI ≥ HI_min**. |
| `cold`  | Muy frío                | **T2M** y/o **Wind Chill (WC)**                      | MERRA‑2          | **mínima diaria** (T y WC)    | `T_max = 0 °C`, `WC_max = −5 °C`        | **ANY** | Se cumple si **T ≤ T_max** **o** **WC ≤ WC_max**. Modo estricto posible con `ALL`.       |
| `windy` | Muy ventoso             | Viento 10 m (speed); **ráfagas** si hay              | MERRA‑2          | **máximo diario**             | `V_min = 50 km/h`, `gust_min = 70 km/h` | **ANY** | Si no hay ráfagas, usar **p95** del día como proxy de ráfaga.                            |
| `wet`   | Muy mojado              | **Precipitación**                                    | GPM **IMERG**    | **acumulado diario** (mm/día) | `P_daily = 25 mm`, `P_rate = 7.6 mm/h`  | **ANY** | Cumple por **lluvia diaria** o por **intensidad** si existe dato horario.                |
| `muggy` | Muy incómodo (bochorno) | **Índice de Calor (HI)** y/o **Punto de rocío (Td)** | MERRA‑2          | **máximo diario**             | `HI_min = 32 °C`, `Td_min = 21 °C`      | **ANY** | Se cumple si **HI ≥ HI_min** **o** **Td ≥ Td_min**.                                      |

* **Lógica (`ANY`/`ALL`) por condición:** por defecto **ANY** (cumple si **cualquiera** de los umbrales definidos se excede). En “modo estricto” se puede cambiar a **ALL** (deben cumplirse **todos**).
* **Más opciones de umbral:** cada condición admite **más de un umbral** (p. ej., viento sostenido **o** ráfaga; HI **o** Td). Cualquier umbral puede ponerse en `null` para **ignorar** esa vía.

---

## 2) Ventana estacional y periodo de referencia

* **Ventana alrededor de la fecha objetivo:** **±15 días** (TOTAL ≈ 31 días/año).
* **Años considerados:** **últimos 20 años** (`years_mode = lastN`, `lastN_years = 20`).
* **Mínimo de muestra:** `min_sample_size = 300` días válidos.

> Con ±15 días y 20 años, el máximo teórico ≈ **620** días. Exigir **300** asegura robustez si hay huecos.

---

## 3) Reglas de cálculo de probabilidad

1. Extraer la **serie histórica diaria** para la ventana ±15 días en los últimos 20 años.
2. Aplicar la **agregación diaria** (máx/mín/suma según condición).
3. Evaluar **excedencia** con la **lógica** definida (ANY/ALL) y los umbrales activos (no `null`).
4. `probabilidad = (n_días_excedencia / n_días_totales) × 100`.
5. Reportar **tamaño de muestra**, **rango de años** y **estadísticos** (media, P10, P50, P90).

---

## 4) Fórmulas derivadas (se detallarán en `formulas.md`)

* **Índice de Calor (HI)** — requiere **T (°C)** y **HR (%)**. (Rothfusz/NOAA).
* **Wind Chill (WC)** — requiere **T (°C)** y **Viento (km/h)**. (NOAA/MSC 2001).
* **Punto de rocío (Td)** — requiere **T (°C)** y **HR (%)**. (Magnus‑Tetens).

> **Rangos de validez** se aplicarán en implementación (p. ej., WC sólo con T baja; HI con T alta y HR significativa). Si falta HR, se prioriza **HI** desactivado y se usa **Td** si puede derivarse; si no, se omite `muggy`.

---

## 5) Unidades, tiempo y resolución

* **Unidades internas:** **SI** (°C, mm, km/h).
* **UI:** **toggle** SI ⇄ Imperial (°F, in, mph).
* **Tiempo:** UTC para cómputo; etiquetado local opcional (pendiente).
* **Resolución temporal:** **diaria** (intensidad horaria sólo donde aplique).

---

## 6) Fallbacks y control de calidad

* **Ráfagas ausentes:** usar **percentil 95** del viento del día como proxy (`gust_proxy_percentile = 95`).
* **HR ausente:** intentar derivar **Td**; si no es posible, **omitir `muggy`** y avisar.
* **Huecos de datos:** excluir días sin valor; si `n_días_totales < min_sample_size`, devolver **“muestra insuficiente”**.
* **Outliers:** recorte opcional **P1–P99** (`outlier_clip = [1,99]`).

---

## 7) Personalización (sliders en UI)

* `hot`: `T_min` **32 °C** (rango **25–45**), `HI_min` *(opcional)* **null** (rango **27–46**).
* `cold`: `T_max` **0 °C** (rango **−20–10**), `WC_max` **−5 °C** (rango **−30–5**).
* `windy`: `V_min` **50 km/h** (rango **20–100**), `gust_min` **70 km/h** (rango **30–120**).
* `wet`: `P_daily` **25 mm** (rango **5–80**), `P_rate` **7.6 mm/h** (rango **2–30**).
* `muggy`: `HI_min` **32 °C** (rango **27–46**), `Td_min` **21 °C** (rango **16–26**).

---