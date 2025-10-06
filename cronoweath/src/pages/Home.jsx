import { useEffect, useMemo, useState } from "react";
import Calendar from "../components/Calendar.jsx";
import "./home.css";

const API_BASE_URL = (import.meta.env.VITE_API_URL || "http://localhost:8000").replace(/\/$/, "");

const PRESET_LOCATIONS = [
  { label: "Mexico City, MX", lat: 19.4326, lon: -99.1332, iconClass: "fa-history" },
  { label: "Paris, FR", lat: 48.8566, lon: 2.3522, iconClass: "fa-history" },
  { label: "Tokyo, JP", lat: 35.6762, lon: 139.6503, iconClass: "fa-history" },
  { label: "London, UK (favorite)", lat: 51.5072, lon: -0.1276, iconClass: "fa-star" },
];

const CONDITION_LABELS = {
  hot: "Muy caliente",
  cold: "Muy frío",
  windy: "Muy ventoso",
  wet: "Muy mojado",
  muggy: "Muy incómodo",
};

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const getInitialCursor = () => {
  const today = new Date();
  return { month: today.getMonth(), year: today.getFullYear() };
};

const formatDateDisplay = (date) =>
  date.toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" });

const formatDateInput = (date) => {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

const toIsoDate = (date) => date.toISOString().slice(0, 10);

const average = (values) => {
  const filtered = values.filter((value) => Number.isFinite(value));
  if (!filtered.length) return null;
  const sum = filtered.reduce((acc, value) => acc + value, 0);
  return sum / filtered.length;
};

const cToF = (value) => (value * 9) / 5 + 32;

const computeDayOfWeekStats = (timeseries = []) => {
  const stats = Array.from({ length: 7 }, (_, dow) => ({
    dow,
    total: 0,
    exceed: 0,
    sumTemp: 0,
    sumWind: 0,
    sumPrecip: 0,
  }));

  timeseries.forEach((row) => {
    if (!row?.date) return;
    const date = new Date(row.date);
    if (Number.isNaN(date.getTime())) return;
    const dow = date.getDay();
    const bucket = stats[dow];
    bucket.total += 1;
    bucket.exceed += row.exceed ? 1 : 0;
    if (Number.isFinite(row.t2m_max)) bucket.sumTemp += row.t2m_max;
    if (Number.isFinite(row.wind_speed_max)) bucket.sumWind += row.wind_speed_max;
    if (Number.isFinite(row.precip_daily)) bucket.sumPrecip += row.precip_daily;
  });

  return stats.map((bucket) => ({
    dow: bucket.dow,
    pct: bucket.total ? Math.round((bucket.exceed / bucket.total) * 100) : 0,
    avgTemp: bucket.total ? bucket.sumTemp / bucket.total : null,
    avgWind: bucket.total ? bucket.sumWind / bucket.total : null,
    avgPrecip: bucket.total ? bucket.sumPrecip / bucket.total : null,
    samples: bucket.total,
  }));
};

const chooseIconForStat = (stat) => {
  if (stat.avgPrecip != null && stat.avgPrecip >= 5) return "rain";
  if (stat.avgWind != null && stat.avgWind >= 35) return "wind";
  if (stat.avgTemp != null && stat.avgTemp <= 5) return "cloud";
  return "sun";
};

const renderForecastIcon = (type, isActive) => {
  const stroke = isActive ? "#0c2135" : "#ffffff";
  switch (type) {
    case "wind":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9.59 4.59A2 2 0 1 1 11 8H2" />
          <path d="M12.59 19.41A2 2 0 1 0 14 16H2" />
          <path d="M17.73 10.73A2.5 2.5 0 1 1 19.5 12H2" />
        </svg>
      );
    case "cloud":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17.5 19.5A5 5 0 0 0 19 10h-1.5A3.5 3.5 0 0 0 12 3.5 3.5 3.5 0 0 0 8.5 7H7a5 5 0 0 0 0 10h10.5z" />
        </svg>
      );
    case "rain":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 17a5 5 0 0 0-5-5h-1.26A8 8 0 0 0 4 9a4.5 4.5 0 0 0 4.5 4.5H10l-2 4h4l2-4h2a5 5 0 0 0 5-5z" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2v2" />
          <path d="M12 20v2" />
          <path d="M4.93 4.93l1.41 1.41" />
          <path d="M17.66 17.66l1.41 1.41" />
          <path d="M2 12h2" />
          <path d="M20 12h2" />
          <path d="M6.34 17.66l-1.41 1.41" />
          <path d="M19.07 4.93l-1.41 1.41" />
          <circle cx="12" cy="12" r="4" />
        </svg>
      );
  }
};

async function geocodeLocation(query) {
  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.searchParams.set("name", query);
  url.searchParams.set("count", "5");
  url.searchParams.set("language", "es");
  url.searchParams.set("format", "json");

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Error geocoding (${response.status})`);
  }
  const payload = await response.json();
  const results = payload.results || [];
  return results.map((item) => ({
    label: `${item.name}${item.admin1 ? `, ${item.admin1}` : ""}${item.country ? `, ${item.country}` : ""}`,
    lat: item.latitude,
    lon: item.longitude,
    iconClass: "fa-location-dot",
  }));
}

export default function Home() {
  const defaultLocation = PRESET_LOCATIONS[0];
  const [config, setConfig] = useState(null);
  const [configError, setConfigError] = useState(null);

  const [heroInput, setHeroInput] = useState("");
  const [heroSuggestions, setHeroSuggestions] = useState(PRESET_LOCATIONS);
  const [heroOpen, setHeroOpen] = useState(false);
  const [resolvingLocation, setResolvingLocation] = useState(false);
  const [heroMessage, setHeroMessage] = useState(null);
  const [heroError, setHeroError] = useState(null);
  const [locationLabel, setLocationLabel] = useState(defaultLocation.label);

  const [form, setForm] = useState({
    lat: defaultLocation.lat,
    lon: defaultLocation.lon,
    condition: "hot",
    targetDay: "",
  });
  const [targetDate, setTargetDate] = useState(null);
  const [calendarCursor, setCalendarCursor] = useState(getInitialCursor);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [lastQueryLocation, setLastQueryLocation] = useState(defaultLocation.label);
  const [temperatureUnit, setTemperatureUnit] = useState("C");

  useEffect(() => {
    async function loadConfig() {
      try {
        const response = await fetch(`${API_BASE_URL}/conditions`);
        if (!response.ok) {
          throw new Error(`Error ${response.status}`);
        }
        const data = await response.json();
        setConfig(data);
        const defaultCondition = Object.keys(data.conditions || {})[0] || "hot";
        setForm((prev) => ({
          ...prev,
          condition: defaultCondition,
        }));
      } catch (err) {
        setConfigError(`No se pudo cargar la configuración: ${err.message}`);
      }
    }
    loadConfig();
  }, []);

  const conditionOptions = useMemo(
    () => Object.keys(config?.conditions || {}),
    [config]
  );

  const closeSuggestionsLater = () => {
    window.setTimeout(() => setHeroOpen(false), 150);
  };

  const applyLocation = (location, message = null) => {
    setHeroError(null);
    setHeroMessage(message || `Ubicación establecida: ${location.label}`);
    setLocationLabel(location.label);
    setHeroInput(location.label);
    setHeroSuggestions(PRESET_LOCATIONS);
    setHeroOpen(false);
    setForm((prev) => ({
      ...prev,
      lat: Number(location.lat.toFixed(4)),
      lon: Number(location.lon.toFixed(4)),
    }));
  };

  const handleHeroSuggestionClick = (suggestion) => {
    applyLocation(suggestion);
  };

  const handleHeroSubmit = async (event) => {
    event.preventDefault();
    const query = heroInput.trim();
    if (!query) {
      setHeroError("Ingresa una ubicación para empezar.");
      return;
    }

    const preset = PRESET_LOCATIONS.find((item) => item.label.toLowerCase() === query.toLowerCase());
    if (preset) {
      applyLocation(preset);
      return;
    }

    try {
      setResolvingLocation(true);
      setHeroError(null);
      setHeroMessage("Buscando ubicación...");
      const matches = await geocodeLocation(query);
      if (matches.length === 0) {
        setHeroMessage(null);
        setHeroError("No encontramos coincidencias. Intenta con otro nombre o especifica el país.");
        setHeroSuggestions(PRESET_LOCATIONS);
        setHeroOpen(false);
        return;
      }
      setHeroSuggestions(matches);
      setHeroOpen(true);
      setHeroMessage("Selecciona una opción de la lista");
    } catch (err) {
      setHeroMessage(null);
      setHeroError(`No se pudo resolver la ubicación: ${err.message}`);
    } finally {
      setResolvingLocation(false);
    }
  };

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      setHeroError("Tu navegador no soporta geolocalización.");
      return;
    }
    setResolvingLocation(true);
    setHeroMessage("Obteniendo tu ubicación...");
    setHeroError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        applyLocation({ label: "Ubicación actual", lat: latitude, lon: longitude }, "Ubicación actual detectada");
        setResolvingLocation(false);
      },
      (geoError) => {
        setResolvingLocation(false);
        switch (geoError.code) {
          case geoError.PERMISSION_DENIED:
            setHeroError("Permiso denegado para obtener tu ubicación.");
            break;
          case geoError.POSITION_UNAVAILABLE:
            setHeroError("Ubicación no disponible en este momento.");
            break;
          case geoError.TIMEOUT:
            setHeroError("La petición de ubicación expiró. Intenta nuevamente.");
            break;
          default:
            setHeroError("No se pudo obtener tu ubicación.");
        }
        setHeroMessage(null);
      }
    );
  };

  const openCalendar = () => {
    setCalendarCursor((prev) => {
      const base = targetDate || new Date();
      return { month: base.getMonth(), year: base.getFullYear() };
    });
    setIsCalendarOpen(true);
  };

  const closeCalendar = () => setIsCalendarOpen(false);

  const handlePrevMonth = () => {
    setCalendarCursor((cursor) => {
      if (cursor.month === 0) {
        return { month: 11, year: cursor.year - 1 };
      }
      return { month: cursor.month - 1, year: cursor.year };
    });
  };

  const handleNextMonth = () => {
    setCalendarCursor((cursor) => {
      if (cursor.month === 11) {
        return { month: 0, year: cursor.year + 1 };
      }
      return { month: cursor.month + 1, year: cursor.year };
    });
  };

  const handleSelectDay = (day) => {
    const selected = new Date(calendarCursor.year, calendarCursor.month, day);
    setTargetDate(selected);
    setForm((prev) => ({ ...prev, targetDay: toIsoDate(selected) }));
    setIsCalendarOpen(false);
  };

  const handleConditionChange = (event) => {
    const value = event.target.value;
    setForm((prev) => ({ ...prev, condition: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);
    setResult(null);

    if (!form.targetDay) {
      setError("Selecciona una fecha objetivo.");
      return;
    }

    const payload = {
      location: { lat: form.lat, lon: form.lon },
      target_day: form.targetDay,
      condition: form.condition,
      logic: config?.conditions?.[form.condition]?.logic || "ANY",
      units: "SI",
      thresholds: null,
      window_days: config?.window_days ?? 15,
      years_mode: "lastN",
      lastN_years: config?.lastN_years ?? 20,
      outlier_clip: config?.outlier_clip ?? [1, 99],
      gust_proxy_percentile: config?.gust_proxy_percentile ?? 95,
      include_timeseries: true,
    };

    setSubmitting(true);
    try {
      const response = await fetch(`${API_BASE_URL}/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || "Error desconocido");
      }
      setTemperatureUnit("C");
      setLastQueryLocation(locationLabel);
      if (data.status === "insufficient_sample") {
        setResult({ type: "insufficient", data });
      } else {
        setResult({ type: "success", data });
      }
    } catch (err) {
      setError(`No se pudo completar la consulta: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const dashboardData = useMemo(() => {
    if (!result || result.type !== "success") return null;
    const data = result.data;
    const timeseries = data.timeseries || [];
    const dayStats = computeDayOfWeekStats(timeseries);
    const activeDow = targetDate ? targetDate.getDay() : null;
    const overallTemp = average(timeseries.map((row) => (Number.isFinite(row.t2m_max) ? row.t2m_max : null)));
    const activeStat = activeDow != null ? dayStats.find((stat) => stat.dow === activeDow) : null;
    const displayTemp = activeStat?.avgTemp ?? overallTemp;

    const points = dayStats.map((stat, index) => {
      const pct = Number.isFinite(stat.pct) ? stat.pct : 0;
      const x = (index / Math.max(dayStats.length - 1, 1)) * 500;
      const y = 100 - pct;
      return { x, y, pct };
    });

    const forecast = dayStats.map((stat) => ({
      dow: stat.dow,
      label: DAY_LABELS[stat.dow],
      iconType: chooseIconForStat(stat),
    }));

    return {
      conditionLabel: CONDITION_LABELS[data.condition] || data.condition,
      probability: data.probability_pct,
      dataset: (data.dataset_used || []).join(", ") || "N/A",
      notes: data.notes || [],
      thresholds: data.thresholds_resolved || {},
      stats: data.stats || null,
      sampleDays: data.sample?.n_days ?? null,
      sampleCoverage: data.sample?.coverage_pct ?? null,
      logic: data.logic,
      generatedAt: data.generated_at,
      timeseries,
      dayStats,
      activeDow,
      displayTemp,
      points,
      forecast,
    };
  }, [result, targetDate]);

  const formattedDate = targetDate ? formatDateInput(targetDate) : "DD/MM/YYYY";
  const selectedDateDisplay = targetDate ? formatDateDisplay(targetDate) : "Selecciona una fecha";

  const renderDashboard = () => {
    if (!result) {
      return (
        <div className="cw-placeholder-card">
          Selecciona una ubicación y fecha, luego presiona “Calcular probabilidad”.
        </div>
      );
    }

    if (result.type === "insufficient") {
      return (
        <div className="cw-placeholder-card">
          {result.data.message || "No se encontró muestra suficiente para la combinación solicitada."}
        </div>
      );
    }

    if (!dashboardData) return null;

    const { conditionLabel, probability, dataset, notes, thresholds, stats, sampleDays, sampleCoverage, displayTemp, points, forecast, activeDow } = dashboardData;

    const temperatureC = displayTemp != null ? displayTemp : null;
    const temperatureValue = temperatureC != null ? (temperatureUnit === "C" ? temperatureC : cToF(temperatureC)) : null;
    const chartPoints = points
      .map(({ x, y }) => `${x.toFixed(1)},${y.toFixed(1)}`)
      .join(" ");

    return (
      <div className="cw-dashboard-container">
        <header className="cw-page-header">
          <h2 className="cw-logo">CRONOWEATH</h2>
          <div className="cw-selected-date">{selectedDateDisplay}</div>
        </header>

        <section className="cw-card cw-location-card">
          <div className="cw-card-label">Location</div>
          <div className="cw-card-content">
            <div>
              <div className="cw-card-main">{lastQueryLocation}</div>
              <div className="cw-card-footer">Datos promedio basados en el histórico consultado.</div>
            </div>
            <div className="cw-weather-display">
              <svg className="cw-weather-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9.59 4.59A2 2 0 1 1 11 8H2" />
                <path d="M12.59 19.41A2 2 0 1 0 14 16H2" />
                <path d="M17.73 10.73A2.5 2.5 0 1 1 19.5 12H2" />
              </svg>
              <span className="cw-temperature">{temperatureValue != null ? `${Math.round(temperatureValue)}°${temperatureUnit}` : "--"}</span>
              <div className="cw-temp-toggle">
                <button type="button" className={temperatureUnit === "C" ? "active" : ""} onClick={() => setTemperatureUnit("C")}>
                  C
                </button>
                {" | "}
                <button type="button" className={temperatureUnit === "F" ? "active" : ""} onClick={() => setTemperatureUnit("F")}>
                  F
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="cw-card cw-condition-card">
          <div className="cw-card-label">Condition</div>
          <div className="cw-card-content">
            <div className="cw-card-main">{conditionLabel}</div>
            <div className="cw-condition-percentage">{probability != null ? `${probability}%` : "--"}</div>
          </div>
          <div className="cw-card-footer">Probabilidad estimada de ocurrencia</div>
        </section>

        <section className="cw-card cw-histogram-card">
          <div className="cw-card-header">
            <div className="cw-card-label">Histogram</div>
            <div className="cw-dropdown">
              A year ago
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>
          </div>
          <div className="cw-chart-container">
            <ul className="cw-y-axis">
              {[100, 90, 80, 70, 60, 50, 40, 30, 20, 10].map((label) => (
                <li key={label}>{label}%</li>
              ))}
            </ul>
            <div className="cw-chart-area">
              <svg width="100%" height="100%" viewBox="0 0 500 100" preserveAspectRatio="none">
                <polyline fill="none" stroke="#ffffff" strokeWidth="2" points={chartPoints || "0,100 500,100"} />
                {points.map(({ x, y }, index) => (
                  <circle key={index} cx={x} cy={y} r="4" fill="#ffffff" />
                ))}
              </svg>
            </div>
          </div>
        </section>

        <nav className="cw-forecast-bar">
          {forecast.map((item) => (
            <div key={item.dow} className={`cw-day ${activeDow === item.dow ? "active" : ""}`}>
              <span>{DAY_LABELS[item.dow]}</span>
              {renderForecastIcon(item.iconType, activeDow === item.dow)}
            </div>
          ))}
        </nav>

        {notes.length ? (
          <div className="cw-notes">
            {notes.map((note) => (
              <span key={note} className="cw-tag">
                {note}
              </span>
            ))}
          </div>
        ) : null}

        <footer className="cw-page-footer">Analyzing decades of NASA data.</footer>
      </div>
    );
  };

  return (
    <div className="cw-app">
      <section className="cw-hero">
        <h1 className="cw-main-title">CRONOWEATH</h1>
        <form className="cw-search-form" onSubmit={handleHeroSubmit}>
          <div className="cw-search-box">
            <label htmlFor="hero-location" className="sr-only">
              Buscar ubicación
            </label>
            <input
              id="hero-location"
              type="search"
              autoComplete="off"
              placeholder="Enter a location (e.g., Paris, Mexico, your city, etc.)"
              value={heroInput}
              onChange={(event) => setHeroInput(event.target.value)}
              onFocus={() => {
                setHeroSuggestions((prev) => (prev.length ? prev : PRESET_LOCATIONS));
                setHeroOpen(true);
              }}
              onBlur={closeSuggestionsLater}
              className="cw-location-input"
            />
            <button type="submit" className="cw-search-button" aria-label="Search location" disabled={resolvingLocation}>
              <i className="fas fa-search" />
            </button>
          </div>

          <div className={`cw-suggestions-panel ${heroOpen && heroSuggestions.length ? "is-open" : ""}`}>
            <ul>
              {(heroSuggestions.length ? heroSuggestions : PRESET_LOCATIONS).map((item, index) => (
                <li
                  key={`${item.label}-${index}`}
                  className="cw-suggestion-item"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => handleHeroSuggestionClick(item)}
                >
                  <i className={`fas ${item.iconClass}`} />
                  <span>{item.label}</span>
                </li>
              ))}
            </ul>
          </div>
        </form>

        <div className="cw-hero-actions">
          <button type="button" className="cw-primary-action" onClick={handleUseMyLocation} disabled={resolvingLocation}>
            {resolvingLocation ? "Obteniendo ubicación..." : "Usar mi ubicación actual"}
          </button>
          {heroMessage ? <span className="cw-hero-message">{heroMessage}</span> : null}
          {heroError ? <span className="cw-hero-error">{heroError}</span> : null}
        </div>

        <footer className="cw-footer">Analyzing decades of NASA data.</footer>
      </section>

      <section className="cw-date-section">
        <div className="cw-date-wrapper">
          <button
            type="button"
            className={`cw-date-input ${isCalendarOpen ? "is-active" : ""}`}
            onClick={() => (isCalendarOpen ? closeCalendar() : openCalendar())}
          >
            {formattedDate}
          </button>
          <span className="cw-date-icon">
            <i className="fas fa-calendar" />
          </span>
        </div>
        <div className="cw-date-hint">Selecciona la fecha aproximada que deseas analizar.</div>
      </section>

      {isCalendarOpen ? (
        <div className="cw-calendar-popover">
          <Calendar
            cursor={calendarCursor}
            selectedDate={targetDate}
            onPrevMonth={handlePrevMonth}
            onNextMonth={handleNextMonth}
            onSelectDay={handleSelectDay}
          />
        </div>
      ) : null}

      <section className="cw-analysis">
        <div className="cw-analysis-inner">
          <div className="cw-analysis-header">
            <p>Configuración avanzada</p>
            <h2>{locationLabel}</h2>
            <p>
              Ventana ±{config?.window_days ?? 15} días • {config?.lastN_years ?? 20} años analizados
            </p>
          </div>

          {configError ? (
            <p className="cw-error" role="alert">
              {configError}
            </p>
          ) : null}

          <form className="cw-controls" onSubmit={handleSubmit}>
            <label className="sr-only" htmlFor="cw-condition-select">
              Condición a evaluar
            </label>
            <select id="cw-condition-select" className="cw-select" value={form.condition} onChange={handleConditionChange}>
              {conditionOptions.map((key) => (
                <option key={key} value={key}>
                  {CONDITION_LABELS[key] || key}
                </option>
              ))}
            </select>
            {error ? <span className="cw-error">{error}</span> : null}
            <button type="submit" className="cw-secondary-action" disabled={submitting}>
              {submitting ? "Consultando..." : "Calcular probabilidad"}
            </button>
          </form>

          {renderDashboard()}
        </div>
      </section>
    </div>
  );
}
