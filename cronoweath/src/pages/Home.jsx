import { useCallback, useEffect, useRef, useState } from "react";
import Calendar from "../components/Calendar.jsx";
import "./home-figma.css";

const MIN_QUERY_LENGTH = 3;

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
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(4)}°`;
}

function formatSelectedDate(date) {
  if (!date) return "Selecciona un día en el calendario";
  return date.toLocaleDateString("es-ES", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
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

  const closeTimerRef = useRef(null);
  const fetchControllerRef = useRef(null);
  const inputRef = useRef(null);

  const trimmedQuery = query.trim();

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  useEffect(
    () => () => {
      clearCloseTimer();
      if (fetchControllerRef.current) {
        fetchControllerRef.current.abort();
        fetchControllerRef.current = null;
      }
    },
    [clearCloseTimer],
  );

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

  const activateLocation = useCallback((location) => {
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
  }, []);

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
      setLocationError("Ingresa una ubicación para continuar.");
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
        setLocationError("No encontramos esa ubicación. Intenta con otra.");
        return;
      }
      activateLocation(results[0]);
    } catch (error) {
      console.error(error);
      setResolvedLocation(null);
      setSelectedLocation(null);
      setLocationError("No se pudo consultar la ubicación. Intenta de nuevo.");
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
    setStep("search");
    setPanelOpen(false);
    setSuggestions([]);
    setSuggestionsError(null);
    setLocationError(null);
    setResolvingSubmit(false);
    setQuery(resolvedLocation ? resolvedLocation.label : "");
  };

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
                Buscar ubicación
              </label>
              <input
                id="location-input"
                ref={inputRef}
                type="text"
                placeholder="Ingresa una ciudad o ubicación"
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
                aria-label="Buscar ubicación"
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
            <p className="search-status">Resolviendo ubicación…</p>
          ) : null}
          {locationError ? (
            <p className="location-error" role="alert">
              {locationError}
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
          <p className="small-text">Analyzing decades of NASA data.</p>
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
            <p className="calendar-heading">Ubicación confirmada</p>
            <h2 className="calendar-location">{resolvedLocation.label}</h2>
            <ul className="calendar-meta">
              {meta.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            </div>
          <button type="button" className="calendar-back" onClick={handleChangeLocation}>
            Cambiar ubicación
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
              <button type="button" className="calendar-primary" disabled={!selectedDate}>
                Continuar
              </button>
              </div>
          </aside>
        </section>
        </div>
    );
  };

  return step === "search" ? renderSearchStep() : renderCalendarStep();
};

export default Home;
