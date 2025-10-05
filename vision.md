# Visión — PWA “Probabilidad de Clima” (NASA Space Apps 2025)

## Resumen ejecutivo

Construiremos una aplicación web (PWA) que, para **un lugar** y **una fecha** (día del año) elegidos por la persona usuaria, entregue la **probabilidad de condiciones climáticas adversas** (muy caliente, muy frío, muy ventoso, muy mojado, muy incómodo) basada en **series históricas** de datos observacionales y de reanálisis de NASA. **No es un pronóstico determinista**, sino una **estimación estadística** de excedencia de umbrales configurables.

---

## Problema

Las apps de clima comunes dan pronóstico a días vista (1–10 días) o promedios. Quien planifica con **semanas o meses de anticipación** no tiene una estimación clara de **qué tan probable** es enfrentar calor extremo, lluvia intensa, viento fuerte o bochorno en una fecha y lugar concretos.

## Oportunidad

NASA pone a disposición **décadas de datos** globales (satélite y reanálisis). Con ellos es posible calcular, para un sitio concreto y un día del año, la **frecuencia histórica** con la que se superan ciertos **umbrales** (p. ej., T ≥ 32 °C), lo cual ayuda a decidir y prepararse.

## Propuesta de valor

* **Para público general:** interfaz simple, sliders de umbral, un porcentaje claro y un gráfico que explique el contexto.
* **Para perfiles técnicos:** permitir ajustar umbrales, ver la muestra usada y descargar **CSV/JSON** del subset y estadísticas.

---

## Usuarios y casos de uso

* **Organizadores/as de eventos**, escuelas, deportes al aire libre.
* **Excursionistas y turistas** (planeación de vacaciones, caminatas, pesca, etc.).
* **Investigadores/as y estudiantes** que requieran probabilidades históricas rápidas por sitio/fecha.

---

## Alcance del MVP

1. **Búsqueda por lugar** (texto o lat/lon) y **fecha** (día/mes).
2. **5 condiciones** con umbrales por defecto **editables**:

   * Muy caliente, Muy frío, Muy ventoso, Muy mojado (lluvia), Muy incómodo (bochorno).
3. **Salida principal:** porcentaje de probabilidad + gráfico (línea/histograma) + texto explicativo.
4. **Descarga** de resultados (CSV/JSON) y **historial offline** (últimas consultas).
5. **PWA** con funcionamiento **offline parcial** (UI, último resultado y configuración almacenados localmente).

### Fuera de alcance (MVP)

* **Pronóstico determinista** a corto plazo (modelos numéricos de predicción).
* Resolución horaria detallada para todas las variables (empezaremos con diario; intensidad horaria es opcional para lluvia).
* Mapas interactivos complejos (primero, formularios + gráficos simples).

---

## Datos y fuentes (NASA)

* **Precipitación:** GPM **IMERG** (acumulados diarios; opcional: tasas horarias para intensidad).
* **Temperatura, humedad, viento:** **MERRA‑2** (2 m T/HR; 10 m viento; reanálisis global).
* **Acceso:** Earthdata Search (descubrimiento), **GES DISC OPeNDAP/Hyrax** (subsetting vía HTTP), **Giovanni** (exploración visual y series), **tutoriales** en Jupyter (Python) para acceso programático.

> Nota: nos centraremos en **subsets remotos** (OPeNDAP) para evitar descargar volúmenes grandes. Cuando no haya conectividad, se mostrará un **modo demo** con resultados cacheados/última consulta.

---

## Definiciones y umbrales iniciales (editables)

| Condición        | Variable(s) base                                   |                     Umbral SI (default) |                Imperial | Observación                               |
| ---------------- | -------------------------------------------------- | --------------------------------------: | ----------------------: | ----------------------------------------- |
| **Muy caliente** | Temperatura 2 m (T)                                |                           **T ≥ 32 °C** |                 ≥ 90 °F | % de días que superan el umbral.          |
| **Muy frío**     | T o **Wind Chill (WC)**                            |           **T ≤ 0 °C** o **WC ≤ −5 °C** |       ≤ 32 °F o ≤ 23 °F | Usar WC si hay viento.                    |
| **Muy ventoso**  | Viento 10 m (sostenido) y ráfagas                  | **V ≥ 50 km/h** (ráfagas **≥ 70 km/h**) |     ≥ 31 mph (≥ 43 mph) | Tomar máximo diario o percentil alto.     |
| **Muy mojado**   | Precipitación                                      |      **≥ 25 mm/día** (o **≥ 7.6 mm/h**) | ≥ 1 in/día (≥ 0.3 in/h) | Usar acumulado diario; intensidad si hay. |
| **Muy incómodo** | **Índice de calor (HI)** o **punto de rocío (Td)** |         **HI ≥ 32 °C** o **Td ≥ 21 °C** |       ≥ 90 °F o ≥ 70 °F | HI con T y HR; Td de T y HR.              |

> Estos valores son **preajustes**. La UI mostrará **sliders** para que personas técnicas ajusten umbrales.

---

## Metodología (cómo calculamos la probabilidad)

1. **Entrada:** (lat, lon), **día del año** (p. ej., 15 de mayo), **condición** y **umbrales**.
2. **Ventana estacional:** para esa fecha, tomar **±15 días** alrededor del día objetivo en **todos los años** disponibles.
3. **Serie histórica:** obtener la variable base (p. ej., T diaria) para esos días/años.
4. **Criterio de excedencia:** contar cuántos días **cumplen** el umbral (≥ o ≤ según condición).
5. **Probabilidad** = (días que cumplen) / (días totales) × 100.
6. **Salidas adicionales:** tamaño de muestra, años cubiertos, valor medio y percentiles. Opcional: **bootstrap** para bandas de confianza (v2).

> Importante: **No es pronóstico**. Comunicaremos claramente que son **probabilidades históricas**; la atmósfera puede comportarse distinto en el futuro.

---

## Interfaz y experiencia de uso

* **Flujo:** Home → Formulario (Lugar, Fecha, Condición) → Resultado (porcentaje + gráfico + explicación) → Descargar CSV/JSON → Historial offline.
* **Accesibilidad:** lenguaje claro, contraste AA, teclas/lectores de pantalla, descripciones en gráficos.
* **Texto guía:** “Esto NO es un pronóstico; son probabilidades históricas basadas en datos NASA.”

---

## Arquitectura

* **Frontend:** React + Vite (**PWA**), Chart.js para gráficos, almacenamiento local (IndexedDB/localStorage) para umbrales e historial.
* **Backend:** Python (FastAPI), utilidades para fórmulas (HI, WC, Td) y módulo de **descarga/subsetting** (OPeNDAP). Endpoint `/query` calcula y devuelve resultados; `/download` exporta CSV/JSON.
* **Datos:** Preferencia por **lectura remota** (OPeNDAP). **Cache** ligero de últimos resultados. **Modo demo** sin conexión.

---

## Métricas de éxito (KPI)

* **Funcionalidad:** 2 condiciones completas (calor y lluvia) operativas en la demo.
* **Rendimiento:** respuesta < **10 s** para una consulta puntual.
* **Usabilidad:** 90% de personas evaluadoras entiende el resultado sin tutorial.
* **Confiabilidad:** descargas CSV/JSON correctas, sin errores en 3 ubicaciones × 3 meses de prueba.

---

## Riesgos y mitigaciones

* **Volumen/latencia de datos:** usar subsetting (OPeNDAP), limitar ventana y resolución; cachear.
* **Brechas de variables (p. ej., HR):** usar variables alternativas o estimadores (Td) y documentar.
* **Conectividad:** modo demo/offline parcial; últimos resultados persistidos.
* **Interpretación:** copy claro, ejemplos y glosario; etiquetas de incertidumbre.

---

## Ética, seguridad y privacidad

* Datos **abiertos** de NASA; sin **PII**.
* Transparencia en método, umbrales y limitaciones; no para usos críticos de seguridad.
* Atribución a fuentes NASA en la UI y en las descargas.

---

## Plan inmediato (7 días)

1. Wireframes (Figma) y textos (disclaimers, labels).
2. `thresholds.json` + `formulas.md` (HI, WC, Td).
3. Notebook de prototipo: probabilidad “Muy caliente” y “Muy mojado”.
4. FastAPI `/query` con datos de muestra; luego integración OPeNDAP.
5. UI React: formulario + resultado + gráfico + descarga + PWA básica.

---

## Glosario

* **OPeNDAP/Hyrax:** protocolo/servidor para pedir subsets de datos científicos por HTTP.
* **Reanálisis (MERRA‑2):** combinación de observaciones y modelo para series históricas consistentes.
* **Índice de calor (HI):** sensación térmica de calor según T y HR.
* **Wind Chill (WC):** sensación térmica de frío según T y viento.
* **PWA:** app web instalable con soporte offline parcial.

---

## Licencia y atribución

* Datos provienen de NASA (Earthdata, GES DISC, IMERG, MERRA‑2). Se incluirán créditos y enlaces en la app y en los archivos descargados.