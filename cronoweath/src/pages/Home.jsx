import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Calendar from "../components/Calendar.jsx";
import ResultsView from "../components/ResultsView.jsx";
import { getConditionList, prepareConditionViewData } from "../utils/results.js";
import "./home-figma.css";

const MIN_QUERY_LENGTH = 3;

const API_BASE_URL = (() => {
  const value = import.meta.env?.VITE_API_URL;
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim().replace(/\/+$/, "");
  }
  return "https://python-s-nasa-space-app-production.up.railway.app";
})();

const WEEKDAYS_LONG = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miercoles",
  "Jueves",
  "Viernes",
  "Sabado",
];

const MONTHS_LONG = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

async function geocodeLocation(query, { signal } = {}) {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.searchParams.set("name", trimmed);
  url.searchParams.set("count", "6");
  url.searchParams.set("language", "es");
  url.searchParams.set("format", "json");

  const response = await fetch(url.toString(), { signal });
  if (!response.ok) {
    throw new Error(`Error geocoding (${response.status})`);
  }

  const payload = await response.json();
  const results = Array.isArray(payload?.results) ? payload.results : [];
  return results.map((item) => ({
    label: `${item.name}${item.admin1 ? `, ${item.admin1}` : ""}${item.country ? `, ${item.country}` : ""}`,
    name: item.name,
    admin1: item.admin1,
    admin2: item.admin2,
    country: item.country,
    countryCode: item.country_code,
    lat: item.latitude,
    lon: item.longitude,
    timezone: item.timezone,
    elevation: item.elevation,
  }));
}

function getInitialCursor() {
  const today = new Date();
  return { year: today.getFullYear(), month: today.getMonth() };
}

function formatCoordinate(value) {
  if (!Number.isFinite(value)) {
    return "--";
  }
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(4)} deg`;
}

function formatSelectedDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return "Selecciona un dia en el calendario";
  }
  const weekday = WEEKDAYS_LONG[date.getDay()];
  const day = date.getDate();
  const month = MONTHS_LONG[date.getMonth()];
  const year = date.getFullYear();
  return `${weekday}, ${day} ${month} ${year}`;
}

function buildTargetDay(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return null;
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const Home = () => {
  const [step, setStep] = useState("search");
  const [query, setQuery] = useState("");
  const [panelOpen, setPanelOpen] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [suggestionsError, setSuggestionsError] = useState(null);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [resolvedLocation, setResolvedLocation] = useState(null);
  const [locationError, setLocationError] = useState(null);
  const [resolvingSubmit, setResolvingSubmit] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [calendarCursor, setCalendarCursor] = useState(getInitialCursor);

  const [conditionsConfig, setConditionsConfig] = useState(null);
  const [loadingConditions, setLoadingConditions] = useState(false);
  const [conditionsError, setConditionsError] = useState(null);

  const [resultsByCondition, setResultsByCondition] = useState({});
  const [activeCondition, setActiveCondition] = useState(null);
  const [loadingResults, setLoadingResults] = useState(false);
  const [resultsError, setResultsError] = useState(null);

  const closeTimerRef = useRef(null);
  const fetchControllerRef = useRef(null);
  const resultsControllerRef = useRef(null);
  const inputRef = useRef(null);

  const trimmedQuery = query.trim();

  const conditionOptions = useMemo(
    () => getConditionList(conditionsConfig),
    [conditionsConfig],
  );
  const conditionKeys = useMemo(
    () => conditionOptions.map((item) => item.key),
    [conditionOptions],
  );

  const clearResults = useCallback(() => {
    if (resultsControllerRef.current) {
      resultsControllerRef.current.abort();
      resultsControllerRef.current = null;
    }
    setResultsByCondition({});
    setActiveCondition(null);
    setResultsError(null);
    setLoadingResults(false);
  }, []);

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  useEffect(() => () => {
    clearCloseTimer();
    if (fetchControllerRef.current) {
      fetchControllerRef.current.abort();
      fetchControllerRef.current = null;
    }
    if (resultsControllerRef.current) {
      resultsControllerRef.current.abort();
      resultsControllerRef.current = null;
    }
  }, [clearCloseTimer]);

  useEffect(() => {
    let cancelled = false;
    setLoadingConditions(true);
    fetch(`${API_BASE_URL}/conditions`)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        return response.json();
      })
      .then((data) => {
        if (!cancelled) {
          setConditionsConfig(data);
          setConditionsError(null);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          console.error(error);
          setConditionsError("No se pudo cargar la configuracion. Se usaran valores por defecto.");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingConditions(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (step !== "search") {
      if (fetchControllerRef.current) {
        fetchControllerRef.current.abort();
        fetchControllerRef.current = null;
      }
      setSuggestions([]);
      setLoadingSuggestions(false);
      setSuggestionsError(null);
      return;
    }

    if (!trimmedQuery) {
      if (fetchControllerRef.current) {
        fetchControllerRef.current.abort();
        fetchControllerRef.current = null;
      }
      setSuggestions([]);
      setLoadingSuggestions(false);
      setSuggestionsError(null);
      return;
    }

    if (
      selectedLocation &&
      selectedLocation.label.toLowerCase() === trimmedQuery.toLowerCase()
    ) {
      if (fetchControllerRef.current) {
        fetchControllerRef.current.abort();
        fetchControllerRef.current = null;
      }
      setSuggestions([]);
      setLoadingSuggestions(false);
      setSuggestionsError(null);
      return;
    }

    if (trimmedQuery.length < MIN_QUERY_LENGTH) {
      if (fetchControllerRef.current) {
        fetchControllerRef.current.abort();
        fetchControllerRef.current = null;
      }
      setSuggestions([]);
      setLoadingSuggestions(false);
      setSuggestionsError(null);
      return;
    }

    const controller = new AbortController();
    if (fetchControllerRef.current) {
      fetchControllerRef.current.abort();
    }
    fetchControllerRef.current = controller;

    setLoadingSuggestions(true);
    setSuggestionsError(null);

    const timer = setTimeout(() => {
      geocodeLocation(trimmedQuery, { signal: controller.signal })
        .then((results) => {
          if (controller.signal.aborted) return;
          setSuggestions(results);
          setPanelOpen(true);
        })
        .catch((error) => {
          if (controller.signal.aborted) return;
          console.error(error);
          setSuggestions([]);
          setSuggestionsError("No se pudo obtener sugerencias.");
        })
        .finally(() => {
          if (!controller.signal.aborted) {
            setLoadingSuggestions(false);
          }
        });
    }, 250);

    return () => {
      clearTimeout(timer);
      controller.abort();
      if (fetchControllerRef.current === controller) {
        fetchControllerRef.current = null;
      }
    };
  }, [step, trimmedQuery, selectedLocation]);

  useEffect(() => {
    if (step === "search") {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [step]);

  const handleFocus = () => {
    if (step !== "search") return;
    clearCloseTimer();
    if (
      suggestions.length ||
      loadingSuggestions ||
      suggestionsError ||
      trimmedQuery.length >= MIN_QUERY_LENGTH
    ) {
      setPanelOpen(true);
    }
  };

  const handleBlur = () => {
    clearCloseTimer();
    closeTimerRef.current = setTimeout(() => {
      setPanelOpen(false);
    }, 120);
  };

  const activateLocation = useCallback(
    (location) => {
      clearResults();
      setSelectedLocation(location);
      setResolvedLocation(location);
      setQuery(location.label);
      setPanelOpen(false);
      setSuggestions([]);
      setSuggestionsError(null);
      setLocationError(null);
      setResolvingSubmit(false);
      setSelectedDate(null);
      const today = new Date();
      setCalendarCursor({ year: today.getFullYear(), month: today.getMonth() });
      setStep("calendar");
      requestAnimationFrame(() => inputRef.current?.blur());
    },
    [clearResults],
  );

  const handleSuggestionClick = (suggestion) => {
    activateLocation(suggestion);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (step !== "search") return;

    clearCloseTimer();
    setPanelOpen(false);
    inputRef.current?.blur();
    setLocationError(null);

    const trimmed = trimmedQuery;
    if (!trimmed) {
      setResolvedLocation(null);
      setLocationError("Ingresa una ubicacion para continuar.");
      return;
    }

    if (
      selectedLocation &&
      selectedLocation.label.toLowerCase() === trimmed.toLowerCase()
    ) {
      activateLocation(selectedLocation);
      return;
    }

    try {
      setResolvingSubmit(true);
      const results = await geocodeLocation(trimmed);
      if (!results.length) {
        setResolvedLocation(null);
        setSelectedLocation(null);
        setLocationError("No encontramos esa ubicacion. Intenta con otra.");
        return;
      }
      activateLocation(results[0]);
    } catch (error) {
      console.error(error);
      setResolvedLocation(null);
      setSelectedLocation(null);
      setLocationError("No se pudo consultar la ubicacion. Intenta de nuevo.");
    } finally {
      setResolvingSubmit(false);
    }
  };

  const handlePrevMonth = () => {
    setCalendarCursor((prev) =>
      prev.month === 0
        ? { year: prev.year - 1, month: 11 }
        : { year: prev.year, month: prev.month - 1 },
    );
  };

  const handleNextMonth = () => {
    setCalendarCursor((prev) =>
      prev.month === 11
        ? { year: prev.year + 1, month: 0 }
        : { year: prev.year, month: prev.month + 1 },
    );
  };

  const handleSelectDay = (day) => {
    setSelectedDate(new Date(calendarCursor.year, calendarCursor.month, day));
  };

  const handleChangeLocation = () => {
    clearResults();
    setStep("search");
    setPanelOpen(false);
    setSuggestions([]);
    setSuggestionsError(null);
    setLocationError(null);
    setResolvingSubmit(false);
    setQuery(resolvedLocation ? resolvedLocation.label : "");
  };

  const buildQueryPayload = useCallback(
    (conditionKey, targetDay) => {
      if (!resolvedLocation) {
        return null;
      }
      const conditionConfig = conditionsConfig?.conditions?.[conditionKey] ?? {};
      const payload = {
        location: {
          lat: resolvedLocation.lat,
          lon: resolvedLocation.lon,
        },
        target_day: targetDay,
        condition: conditionKey,
        logic: conditionConfig.logic ?? "ANY",
        units: "SI",
        thresholds: conditionConfig.thresholds ?? undefined,
        window_days: conditionsConfig?.window_days ?? 15,
        years_mode: conditionsConfig?.years_mode ?? "lastN",
        lastN_years: conditionsConfig?.lastN_years ?? 20,
        include_timeseries: true,
      };
      if (payload.thresholds == null) {
        delete payload.thresholds;
      }
      return payload;
    },
    [conditionsConfig, resolvedLocation],
  );

  const handleFetchResults = useCallback(async () => {
    if (!resolvedLocation) {
      setResultsError("Selecciona una ubicacion antes de continuar.");
      return;
    }
    if (!selectedDate) {
      setResultsError("Selecciona una fecha en el calendario.");
      return;
    }
    if (!conditionKeys.length) {
      setResultsError("No hay condiciones disponibles para consultar.");
      return;
    }

    const targetDay = buildTargetDay(selectedDate);
    if (!targetDay) {
      setResultsError("La fecha seleccionada no es valida.");
      return;
    }

    if (resultsControllerRef.current) {
      resultsControllerRef.current.abort();
    }
    const controller = new AbortController();
    resultsControllerRef.current = controller;

    setLoadingResults(true);
    setResultsError(null);
    setResultsByCondition({});
    setActiveCondition(null);
    setStep("results");

    try {
      // Ejecuta las condiciones de forma SECUENCIAL para evitar saturar el backend/NASA
      const nextResults = {};
      let firstOk = null;
      let okCount = 0;

      for (const conditionKey of conditionKeys) {
        if (controller.signal.aborted) break;

        const payload = buildQueryPayload(conditionKey, targetDay);
        if (!payload) {
          nextResults[conditionKey] = { status: "error", message: "Falta ubicacion", probability: null };
          continue;
        }

        try {
          // Async mode: inicia tarea y hace polling hasta completar
          const startResp = await fetch(`${API_BASE_URL}/query_async`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            signal: controller.signal,
          });
          if (!startResp.ok) {
            const detail = await startResp.json().catch(() => null);
            const message =
              typeof detail?.detail === "string"
                ? detail.detail
                : `Error ${startResp.status} al iniciar la condicion ${conditionKey}`;
            nextResults[conditionKey] = { status: "error", message, probability: null };
            continue;
          }

          const started = await startResp.json();
          const qid = started?.query_id;
          if (!qid) {
            nextResults[conditionKey] = { status: "error", message: "No query_id", probability: null };
            continue;
          }

          const startedAt = Date.now();
          const maxWaitMs = Number(import.meta.env?.VITE_MAX_WAIT_MS ?? 60000); // extendible por env
          let readyData = null;
          while (Date.now() - startedAt < maxWaitMs) {
            await new Promise((r) => setTimeout(r, 1200));
            const res = await fetch(`${API_BASE_URL}/result?query_id=${encodeURIComponent(qid)}`, {
              method: "GET",
              signal: controller.signal,
            });
            if (res.status === 202) {
              continue; // sigue esperando
            }
            if (!res.ok) {
              const errDetail = await res.json().catch(() => null);
              const message =
                typeof errDetail?.detail === "string"
                  ? errDetail.detail
                  : `Error ${res.status} al obtener la condicion ${conditionKey}`;
              nextResults[conditionKey] = { status: "error", message, probability: null };
              break;
            }
            readyData = await res.json();
            break;
          }

          if (!readyData) {
            nextResults[conditionKey] = {
              status: "error",
              message: "Tiempo de espera agotado (async)",
              probability: null,
            };
            continue;
          }

          if (readyData?.status === "insufficient_sample") {
            nextResults[conditionKey] = { status: "insufficient", payload: readyData, probability: null };
          } else if (!readyData?.query_id) {
            nextResults[conditionKey] = {
              status: "error",
              message: "Respuesta inesperada del servicio.",
              probability: null,
            };
          } else {
            const view = prepareConditionViewData({
              response: readyData,
              condition: conditionKey,
              selectedDate,
              locationLabel: resolvedLocation.label,
            });
            nextResults[conditionKey] = {
              status: "ok",
              payload: readyData,
              view,
              probability: view?.probability ?? null,
            };
            okCount += 1;
            if (!firstOk) firstOk = conditionKey;
          }

          // Publica progreso parcial para mejorar UX
          setResultsByCondition((prev) => ({ ...prev, [conditionKey]: nextResults[conditionKey] }));
          setActiveCondition((prev) => (prev ?? firstOk ?? conditionKey));
        } catch (error) {
          if (controller.signal.aborted) {
            nextResults[conditionKey] = { status: "aborted" };
          } else {
            nextResults[conditionKey] = {
              status: "error",
              message: error instanceof Error ? error.message : "Error desconocido al consultar datos.",
              probability: null,
            };
          }
          setResultsByCondition((prev) => ({ ...prev, [conditionKey]: nextResults[conditionKey] }));
        }
      }

      // Estado final
      setResultsByCondition((prev) => ({ ...prev, ...nextResults }));
      setActiveCondition((prev) => (prev ?? firstOk ?? conditionKeys[0]));

      if (okCount === 0) {
        setResultsError("No se pudo calcular ninguna condicion para la seleccion realizada.");
      } else {
        setResultsError(null);
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        console.error(error);
        setResultsError(
          error instanceof Error ? error.message : "No se pudo completar la consulta.",
        );
      }
    } finally {
      if (resultsControllerRef.current === controller) {
        resultsControllerRef.current = null;
      }
      setLoadingResults(false);
    }
  }, [conditionKeys, resolvedLocation, selectedDate, buildQueryPayload]);

  const renderSearchStep = () => {
    const meta =
      step === "search" && resolvedLocation
        ? [
            resolvedLocation.label,
            `Lat ${formatCoordinate(resolvedLocation.lat)}`,
            `Lon ${formatCoordinate(resolvedLocation.lon)}`,
            resolvedLocation.timezone ? `Zona horaria: ${resolvedLocation.timezone}` : null,
            resolvedLocation.country
              ? resolvedLocation.admin1
                ? `${resolvedLocation.admin1}, ${resolvedLocation.country}`
                : resolvedLocation.country
              : null,
            resolvedLocation.elevation != null ? `Altitud: ${resolvedLocation.elevation} m` : null,
          ].filter(Boolean)
        : [];

    return (
      <div className="main-page">
        <main>
          <h1 className="main-title">CRONOWEATH</h1>
          <form className="search-form" onSubmit={handleSubmit}>
            <div className="search-box">
              <label className="sr-only" htmlFor="location-input">
                Buscar ubicacion
              </label>
              <input
                id="location-input"
                ref={inputRef}
                type="text"
                placeholder="Ingresa una ciudad o ubicacion"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPanelOpen(true);
                }}
                onFocus={handleFocus}
                onBlur={handleBlur}
                autoComplete="off"
              />
              <button
                type="submit"
                className="search-button-inner"
                aria-label="Buscar ubicacion"
                disabled={resolvingSubmit || trimmedQuery.length < MIN_QUERY_LENGTH}
              >
                <i className="fas fa-search" />
              </button>
            </div>
            <div
              className={`suggestions-panel ${panelOpen ? "is-open" : ""}`}
              role="listbox"
              aria-label="Ubicaciones sugeridas"
            >
              <ul>
                {loadingSuggestions ? (
                  <li className="suggestion-item is-placeholder">Buscando ubicaciones...</li>
                ) : suggestions.length > 0 ? (
                  suggestions.map((item) => (
                    <li
                      key={`${item.lat}:${item.lon}`}
                      className="suggestion-item"
                      role="option"
                      tabIndex={-1}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => handleSuggestionClick(item)}
                    >
                      <i className="fas fa-location-dot" />
                      {item.label}
                    </li>
                  ))
                ) : trimmedQuery.length >= MIN_QUERY_LENGTH && !suggestionsError ? (
                  <li className="suggestion-item is-placeholder">Sin resultados</li>
                ) : trimmedQuery ? (
                  <li className="suggestion-item is-placeholder">
                    Escribe al menos {MIN_QUERY_LENGTH} caracteres
                  </li>
                ) : (
                  <li className="suggestion-item is-placeholder">Escribe el nombre de una ciudad</li>
                )}
                {suggestionsError ? (
                  <li className="suggestion-item is-error">{suggestionsError}</li>
                ) : null}
              </ul>
            </div>
          </form>

          {resolvingSubmit ? (
            <p className="search-status">Resolviendo ubicacion.</p>
          ) : null}
          {locationError ? (
            <p className="location-error" role="alert">
              {locationError}
            </p>
          ) : null}
          {conditionsError ? (
            <p className="location-error" role="alert">
              {conditionsError}
            </p>
          ) : null}
          {meta.length ? (
            <ul className="last-location">
              {meta.map((item) => (
                <li key={item} className="meta-chip">
                  {item}
                </li>
              ))}
            </ul>
          ) : null}
        </main>
        <footer className="app-footer-bottom">
          <p className="small-text">Analizando decadas de datos NASA.</p>
        </footer>
      </div>
    );
  };

  const renderCalendarStep = () => {
    if (!resolvedLocation) return null;

    const meta = [
      `Lat ${formatCoordinate(resolvedLocation.lat)}`,
      `Lon ${formatCoordinate(resolvedLocation.lon)}`,
      resolvedLocation.timezone && `Zona horaria: ${resolvedLocation.timezone}`,
      resolvedLocation.country &&
        (resolvedLocation.admin1
          ? `${resolvedLocation.admin1}, ${resolvedLocation.country}`
          : resolvedLocation.country),
      resolvedLocation.elevation != null && `Altitud: ${resolvedLocation.elevation} m`,
    ].filter(Boolean);

    return (
      <div className="calendar-page">
        <header className="calendar-header">
          <div>
            <p className="calendar-heading">Ubicacion confirmada</p>
            <h2 className="calendar-location">{resolvedLocation.label}</h2>
            <ul className="calendar-meta">
              {meta.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <button type="button" className="calendar-back" onClick={handleChangeLocation}>
            Cambiar ubicacion
          </button>
        </header>

        <section className="calendar-content">
          <div className="calendar-widget">
            <Calendar
              cursor={calendarCursor}
              selectedDate={selectedDate}
              onPrevMonth={handlePrevMonth}
              onNextMonth={handleNextMonth}
              onSelectDay={handleSelectDay}
            />
          </div>
          <aside className="calendar-sidebar">
            <h3 className="calendar-sidebar-title">Fecha seleccionada</h3>
            <p className="calendar-selected">{formatSelectedDate(selectedDate)}</p>
            <div className="calendar-actions">
              <button
                type="button"
                className="calendar-secondary"
                onClick={() => setSelectedDate(null)}
                disabled={!selectedDate}
              >
                Limpiar fecha
              </button>
              <button
                type="button"
                className="calendar-primary"
                onClick={handleFetchResults}
                disabled={
                  !selectedDate || loadingResults || (loadingConditions && !conditionsConfig)
                }
              >
                {loadingResults ? "Consultando..." : "Continuar"}
              </button>
            </div>
          </aside>
        </section>
      </div>
    );
  };

  const handleBackToCalendar = () => {
    if (resultsControllerRef.current) {
      resultsControllerRef.current.abort();
      resultsControllerRef.current = null;
    }
    setLoadingResults(false);
    setStep("calendar");
  };

  const renderResultsStep = () => (
    <ResultsView
      location={resolvedLocation}
      selectedDate={selectedDate}
      conditions={conditionOptions}
      activeCondition={activeCondition}
      onSelectCondition={(key) => setActiveCondition(key)}
      results={resultsByCondition}
      loading={loadingResults}
      error={resultsError}
      onRetry={handleFetchResults}
      onBack={handleBackToCalendar}
    />
  );

  if (step === "results") {
    return renderResultsStep();
  }
  if (step === "calendar") {
    return renderCalendarStep();
  }
  return renderSearchStep();
};

export default Home;
