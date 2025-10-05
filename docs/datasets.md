# datasets.md — Fuentes de datos NASA para el MVP

> Catálogo práctico de **qué dataset usar para cada condición**, **qué variable** tomar, **cómo agregar a diario**, y **cómo acceder** (OPeNDAP/Hyrax, Giovanni, Data Rods). Orientado al MVP: formularios + gráficos + cálculo de probabilidad con ventana ±15 días y últimos 20 años.

---

## 0) Mapa rápido condición → dataset/variable

| Condición (variables.md) | Dataset principal   | Variable(s) recomendadas                                           | Resolución típica       | Agregación a diario (para el cómputo)                          |
| ------------------------ | ------------------- | ------------------------------------------------------------------ | ----------------------- | -------------------------------------------------------------- |
| **Muy caliente (hot)**   | **MERRA‑2**         | `T2M` (Temperatura 2 m); opcional `HI` derivado con `T2M` + `RH2M` | 0.5°×0.625°, **1‑hora** | **Máxima diaria** de `T2M`; si hay HI, **máximo diario** de HI |
| **Muy frío (cold)**      | **MERRA‑2**         | `T2M` (mínima diaria); `U10M`/`V10M`→`speed` para **WC**           | 0.5°×0.625°, **1‑hora** | **Mínima diaria** de `T2M`; **WC mínima** (si aplica)          |
| **Muy ventoso (windy)**  | **MERRA‑2**         | `U10M`, `V10M` → `speed` (10 m); **ráfagas**: proxy p95 horaria    | 0.5°×0.625°, **1‑hora** | **Máximo diario** de `speed`; **p95** como proxy de ráfaga     |
| **Muy mojado (wet)**     | **GPM IMERG** (V07) | `precipitationCal` (mm/h) o producto **diario** (mm/día)           | 0.1°, 30‑min (o diaria) | **Suma diaria** (mm/día); opcional **máxima tasa horaria**     |
| **Muy incómodo (muggy)** | **MERRA‑2**         | `T2M`, `RH2M` → **HI**; `T2M`, `RH2M` → **Td**                     | 0.5°×0.625°, **1‑hora** | **Máximo diario** de HI; **máximo diario** de Td               |

> **Ráfagas:** MERRA‑2 no siempre ofrece ráfaga directa a 10 m; en el MVP usaremos **proxy**: percentil **95** del viento horario del día.

---

## 1) Descripción de datasets

### 1.1 MERRA‑2 (Modern‑Era Retrospective analysis for Research and Applications, Version 2)

* **Cobertura**: Global, 1980–presente (latencia de horas a días según producto).
* **Resolución**: Espacial ~0.5°×0.625°; temporal **horaria** en productos “tavg1_2d_*_Nx”.
* **Variables clave**:

  * `T2M` (Air Temperature at 2 m)
  * `U10M`, `V10M` (Viento 10 m)
  * `RH2M` (Humedad relativa 2 m) — si no está, usar `QV2M` (humedad específica) para derivar HR/Td
* **Acceso**: **GES DISC OPeNDAP/Hyrax** (subconjunto por lat/lon/tiempo/variable) y **Giovanni** para exploración visual/series.
* **Por qué MERRA‑2**: consistente en el tiempo, buena disponibilidad horaria → permite derivar **máx/mín** diarios, **HI**, **WC**, **Td**.
* **Notas**:

  * Para **WC**: calcular velocidad `speed = sqrt(U10M² + V10M²)` y aplicar fórmula.
  * Para **HI**: usar `T2M` y `RH2M` (o derivar HR de QV2M + presión, si es necesario).
  * Convertir unidades a **SI** (°C, km/h).

### 1.2 GPM IMERG (Integrated Multi‑satellitE Retrievals for GPM) — V07

* **Cobertura**: 60°S–60°N (global casi total para usos poblados), 2000/2001–presente.
* **Resolución**: Espacial ~0.1°; temporal **30 min** (Early/Late/Final). Existe **producto diario**.
* **Variables clave**:

  * `precipitationCal` (mm/h) — tasa horaria/30‑min; sumable a diario
  * Producto **daily** (mm/día) cuando se requiera rapidez y simplicidad
* **Acceso**: **GES DISC OPeNDAP/Hyrax**, **Giovanni** (mapas/series), **Data Rods (Hydrology)** para series rápidas por punto.
* **Por qué IMERG**: líder en precipitación satelital de alta resolución → ideal para **“muy mojado”**.
* **Notas**:

  * Para **intensidad** usar máximo horario del día (si la ventana horaria está disponible) y compararlo con `P_rate`.
  * Para **acumulado** usar suma de las tasas (mm/h) sobre el día → `P_daily`.

### 1.3 Data Rods for Hydrology

* **Qué es**: servicio que entrega **series temporales por punto** para variables hidrológicas (ej. precipitación), sin descargar archivos grandes.
* **Uso en MVP**: obtener **rápido** un **time‑series** de precipitación para lat/lon y rango de fechas; ideal para prototipado o “modo demo”.
* **Salida**: gráfica y **ASCII/CSV** simple.

### 1.4 Giovanni

* **Qué es**: portal web de **exploración y análisis** (mapas y series) sobre múltiples datasets de NASA.
* **Uso en MVP**: validar patrones, checar si el punto/lugar tiene datos razonables antes de conectar la API; descargar subsets pequeños.

### 1.5 Worldview

* **Qué es**: visualización interactiva de **capas** (nubes, aerosol, precipitación, etc.).
* **Uso en MVP**: apoyo visual para demos/presentaciones; no lo usaremos en la canalización de cálculo.

---

## 2) Agregaciones diarias y reglas por condición (operativas)

| Condición | Base horaria → Diario                                  | Evaluación de umbral                                    | Lógica  |
| --------- | ------------------------------------------------------ | ------------------------------------------------------- | ------- |
| **hot**   | `T2M_max` por día; opcional `HI_max`                   | `T2M_max ≥ T_min` **o** `HI_max ≥ HI_min`               | **ANY** |
| **cold**  | `T2M_min` por día; `WC_min` si hay viento              | `T2M_min ≤ T_max` **o** `WC_min ≤ WC_max`               | **ANY** |
| **windy** | `speed_max` por día; `gust_proxy = p95` horario        | `speed_max ≥ V_min` **o** `gust_proxy ≥ gust_min`       | **ANY** |
| **wet**   | `P_daily = Σ precip_rate` (día); opcional `P_rate_max` | `P_daily ≥ P_daily_thr` **o** `P_rate_max ≥ P_rate_thr` | **ANY** |
| **muggy** | `HI_max`, `Td_max` por día                             | `HI_max ≥ HI_min` **o** `Td_max ≥ Td_min`               | **ANY** |

> Los **percentiles** (P10/P50/P90) se calculan sobre la muestra diaria de la ventana ±15 días × 20 años.

---

## 3) Acceso y subsetting (patrones prácticos)

> **OPeNDAP/Hyrax** permite pedir: **/dataset.nc4?variable[time,lat,lon]** con rangos. Ejemplos genéricos (pseudo‑URL, completar con rutas reales del GES DISC):

* **MERRA‑2 (1‑hora, superficies)**
  `https://.../MERRA2/tavg1_2d_slv_Nx/AAAA/MM/MERRA2_tavg1_2d_slv_Nx.AAAA MM DD.nc4?T2M[time0:timeN][lat_i][lon_j],U10M[...],V10M[...]`

* **IMERG (30‑min o diario)**
  `https://.../GPM/IMERG/AAAA/MM/IMERG.V07B.AAAA MM DD.SSSS.nc4?precipitationCal[time0:timeN][lat_i][lon_j]`

* **Data Rods (serie por punto)**
  `https://.../datarods?lat=..&lon=..&start=AAAA‑MM‑DD&end=AAAA‑MM‑DD&var=precipitation`

**Sugerencias técnicas**

* Calcular índices (HI/WC/Td) **después** de traer `T2M`, `RH2M`, `U10M`, `V10M`.
* Para **diarios** a partir de horarios: usar `groupby(date)` → `max/min/sum` según corresponda.
* Guardar subset en **cache local** (última consulta) para **modo offline parcial**.

---

## 4) Unidades y conversiones

* **Interno (SI)**: °C, mm, km/h.
* **UI**: toggle a °F, in, mph.
* **Conversión viento**: m/s → km/h multiplicando ×3.6.
* **Tiempo**: trabajar en **UTC**; mostrar etiqueta local opcional.

---

## 5) Calidad y vacíos de datos

* **Outliers**: recortar **P1–P99** (opcional).
* **Ráfagas**: si no hay, usar **p95** horario como proxy.
* **HR faltante**: intentar **Td** con QV2M+T/Presión; si no, desactivar `muggy` y avisar.
* **Muestra mínima**: si `< min_sample_size (300)`, devolver **“muestra insuficiente”**.

---

## 6) Decisión para el MVP (qué implementar primero)

1. **Temperatura (hot/cold)** con **MERRA‑2** (T2M, U10M, V10M, RH2M) → más directo y estable.
2. **Precipitación (wet)** con **IMERG daily** (para suma diaria) y, si hay tiempo, intensidad con medio horario.
3. **Viento (windy)** con **MERRA‑2** (speed 10 m; p95 como ráfaga proxy).
4. **Muggy** (HI/Td) con MERRA‑2 cuando confirmemos disponibilidad/derivación de HR.

---

## 7) Checklist de implementación (datos)

* [ ] Endpoints OPeNDAP identificados (MERRA‑2 e IMERG) para 1 punto LAT/LON.
* [ ] Funciones de subsetting y agregación diaria.
* [ ] Cálculo de índices (HI, WC, Td) en utilidades.
* [ ] Cache local del último subset (para offline parcial).
* [ ] Manejo de insuficiencia de muestra y outliers.
* [ ] Tests con 3 climas (costero, montaña, ciudad) y 3 meses.

---

## 8) Notas de licencia/atribución

* Datos abiertos **NASA** (Earthdata / GES DISC / GPM).
* Citar dataset(s) utilizados (MERRA‑2, IMERG), fecha de acceso y ruta/consulta en los **metadatos** de la descarga CSV/JSON.