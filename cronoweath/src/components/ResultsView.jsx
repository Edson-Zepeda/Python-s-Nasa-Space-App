import { useMemo } from "react";
import "../styles/results-dashboard.css";

function renderIcon(name, variant = "default") {
  const baseProps = {
    xmlns: "http://www.w3.org/2000/svg",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    className: variant === "default" ? "weather-icon" : "forecast-icon",
  };

  switch (name) {
    case "sunny":
      return (
        <svg {...baseProps}>
          <circle cx="12" cy="12" r="4" />
          <path
            strokeLinecap="round"
            d="M12 3v2M12 19v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M3 12h2M19 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"
          />
        </svg>
      );
    case "showers":
      return (
        <svg {...baseProps}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M7 17.5 5.5 20M11 17.5 9.5 20M15 17.5 13.5 20" />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M7 15h9a4 4 0 0 0 0-8 5 5 0 0 0-9.7-1.4A3.5 3.5 0 0 0 7 15Z"
          />
        </svg>
      );
    case "windy":
      return (
        <svg {...baseProps}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 11h12a2.5 2.5 0 1 0-2.4-3" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 15h9a2 2 0 1 1-1.9 2.6" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h6" />
        </svg>
      );
    case "rainy":
      return (
        <svg {...baseProps}>
          <path strokeLinecap="round" strokeLinejoin="round" d="m8 17-1 3m5-3-1 3m5-3-1 3" />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M7 15h9a4 4 0 0 0 0-8 5 5 0 0 0-9.7-1.4A3.5 3.5 0 0 0 7 15Z"
          />
        </svg>
      );
    case "cloudy":
      return (
        <svg {...baseProps}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 16h10a4 4 0 1 0-1.5-7.7A5 5 0 0 0 6 6a4 4 0 0 0 0 10Z" />
        </svg>
      );
    case "clear":
      return (
        <svg {...baseProps}>
          <circle cx="9" cy="12" r="4" />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M13 12a4 4 0 0 0 7 2.6 4.5 4.5 0 0 1-6-6.2 4 4 0 0 0-1 3.6Z"
          />
        </svg>
      );
    case "night":
      return (
        <svg {...baseProps}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15.5 3a6.5 6.5 0 1 0 6.5 6.5 4.5 4.5 0 0 1-6.5-6.5Z"
          />
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 12a6 6 0 0 0 6 6" />
        </svg>
      );
    default:
      return (
        <svg {...baseProps}>
          <circle cx="12" cy="12" r="4" />
        </svg>
      );
  }
}

function buildPolylinePoints(values) {
  if (!values?.length) {
    return "";
  }
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max === min ? 1 : max - min;

  return values
    .map((value, index) => {
      const x = (index / (values.length - 1 || 1)) * 100;
      const normalizedY = ((value - min) / range) * 80 + 10;
      const y = 100 - normalizedY;
      return `${x},${y}`;
    })
    .join(" ");
}

function buildAreaPoints(values) {
  if (!values?.length) {
    return "";
  }

  const polyline = buildPolylinePoints(values);
  return `0,100 ${polyline} 100,100`;
}

function ConditionSwitch({ conditions, active, onSelect, results, loading }) {
  if (!conditions?.length) {
    return null;
  }

  return (
    <div className="condition-switch">
      {conditions.map(({ key, label }) => {
        const entry = results[key];
        const isActive = key === active;
        const disabled = loading && !isActive;

        return (
          <button
            key={key}
            type="button"
            onClick={() => onSelect(key)}
            disabled={disabled}
            className={isActive ? "is-active" : ""}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

function StatusBanner({ variant = "info", message, actionLabel, onAction }) {
  if (!message) {
    return null;
  }

  return (
    <div
      className="status-banner"
      style={{
        background:
          variant === "error"
            ? "rgba(255, 99, 99, 0.2)"
            : variant === "warning"
              ? "rgba(255, 204, 102, 0.2)"
              : "rgba(255, 255, 255, 0.24)",
        borderColor:
          variant === "error"
            ? "rgba(255, 99, 99, 0.45)"
            : variant === "warning"
              ? "rgba(255, 204, 102, 0.45)"
              : "rgba(255, 255, 255, 0.35)",
      }}
    >
      <span>{message}</span>
      {actionLabel ? (
        <button
          type="button"
          onClick={onAction}
          className="back-button"
          style={{
            background: "transparent",
            color: variant === "error" ? "#8b1d3f" : "#0c2135",
          }}
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

function ForecastBar({ items }) {
  if (!items?.length) {
    return null;
  }

  return (
    <nav className="forecast-bar">
      {items.map((item) => (
        <div
          key={item.offset}
          className={["day", item.offset === 0 ? "active" : ""].filter(Boolean).join(" ")}
        >
          <span>{item.weekdayShort}</span>
          <span>{item.label}</span>
          {renderIcon(item.icon, "forecast")}
          <span className="text-xl font-extrabold">
            {item.probability != null ? `${item.probability.toFixed(1)}%` : "--"}
          </span>
          <span style={{ color: item.offset === 0 ? "#0c2135" : "rgba(255,255,255,0.75)", fontSize: "0.7rem" }}>
            {item.sample ?? 0} dias
          </span>
        </div>
      ))}
    </nav>
  );
}

export default function ResultsView({
  location,
  selectedDate,
  conditions = [],
  activeCondition,
  onSelectCondition,
  results,
  loading,
  error,
  onRetry,
  onBack,
}) {
  const fallbackLabel = [
    location?.lat != null ? `${location.lat.toFixed(2)}°` : null,
    location?.lon != null ? `${location.lon.toFixed(2)}°` : null,
  ]
    .filter(Boolean)
    .join(", ");

  const locationLabel = location?.label ?? (fallbackLabel || "--");

  const activeEntry = activeCondition ? results[activeCondition] : null;
  const hasResult = activeEntry?.status === "ok";
  const view = hasResult ? activeEntry.view : null;

  const cardData = view?.card;
  const summary = view?.summary;
  const focusDays = view?.timelineFocus?.length
    ? view.timelineFocus
    : view?.timelineFull?.slice(0, 7) ?? [];

  const histogramValues = cardData?.histogram?.values ?? [];
  const polylinePoints = useMemo(
    () => buildPolylinePoints(histogramValues),
    [histogramValues],
  );
  const areaPoints = useMemo(() => buildAreaPoints(histogramValues), [histogramValues]);

  const headlineIcon =
    cardData?.histogram?.icons?.[0] ??
    (focusDays.length ? focusDays[0].icon : undefined) ??
    "cloudy";

  const infoTags = useMemo(() => {
    if (!summary) return [];

    const tags = [];
    if (summary.sample?.n_days != null) {
      tags.push(`Muestra ${summary.sample.n_days} dias`);
    }
    if (summary.sample?.coverage_pct != null) {
      tags.push(`Cobertura ${summary.sample.coverage_pct}%`);
    }
    if (summary.dataset?.length) {
      summary.dataset.forEach((dataset) => tags.push(dataset));
    }
    if (summary.notes?.length) {
      summary.notes.forEach((note) => tags.push(note));
    }
    if (summary.threshold) {
      tags.push(summary.threshold);
    }
    if (summary.windowDays != null) {
      tags.push(`Ventana +/- ${summary.windowDays} dias`);
    }
    return tags;
  }, [summary]);

  const temperatureValue = cardData?.temperature?.value;
  const temperatureUnit = cardData?.temperature?.unit;
  const probability = summary?.probability;

  return (
    <div className="results-page">
      <div className="dashboard-container">
        <header className="page-header">
          <h1 className="logo">CRONOWEATH</h1>
          <div className="header-controls">
            <div className="selected-date">{cardData?.dateLabel ?? "--"}</div>
            <button type="button" className="back-button" onClick={onBack}>
              Cambiar fecha
            </button>
          </div>
        </header>

        <ConditionSwitch
          conditions={conditions}
          active={activeCondition}
          onSelect={onSelectCondition}
          results={results}
          loading={loading}
        />

        {error ? (
          <StatusBanner
            variant="error"
            message={error}
            actionLabel="Reintentar"
            onAction={onRetry}
          />
        ) : null}

        {activeEntry?.status === "error" ? (
          <StatusBanner variant="warning" message={activeEntry.message} />
        ) : null}

        {activeEntry?.status === "insufficient" ? (
          <StatusBanner
            variant="warning"
            message="Muestra insuficiente para la condicion seleccionada."
          />
        ) : null}

        {loading && !hasResult ? (
          <StatusBanner variant="info" message="Consultando datos historicos de la NASA..." />
        ) : null}

        {hasResult ? (
          <>
            <section className="card location-card">
              <div className="card-label">Location</div>
              <div className="card-content">
                <div>
                  <h2 className="card-main-text">{locationLabel}</h2>
                  <div className="card-footer-text">
                    {location?.timezone ? `Zona horaria ${location.timezone}` : "Ubicacion confirmada"}
                  </div>
                </div>
                <div className="weather-display">
                  {renderIcon(headlineIcon)}
                  <span className="temperature-text">
                    {Number.isFinite(temperatureValue) ? temperatureValue.toFixed(1) : "--"}
                  </span>
                  <div className="temp-toggle">
                    <span className="active">{temperatureUnit ?? "SI"}</span> | <span>ALT</span>
                  </div>
                </div>
              </div>
            </section>

            <section className="card condition-card">
              <div className="card-label">Condition</div>
              <div className="card-content">
                <h2 className="card-main-text">{cardData?.condition ?? "--"}</h2>
                <div className="card-side-text">
                  {probability != null ? `${probability.toFixed(1)}%` : "--"}
                </div>
              </div>
              <div className="metric-line">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 12h16M4 16h10M4 8h8" />
                </svg>
                <span>{cardData?.wind ?? "Umbrales por defecto"}</span>
              </div>
            </section>

            <section className="card histogram-card">
              <div className="card-header">
                <div>
                  <div className="card-label">Histogram</div>
                  <div className="card-footer-text">{cardData?.histogram?.description}</div>
                </div>
                <div className="dropdown-button">
                  {cardData?.histogram?.comparison ?? "Serie historica"}
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    width="16"
                    height="16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </div>
              </div>

              <div className="chart-container">
                <ul className="y-axis">
                  {[100, 90, 80, 70, 60, 50, 40, 30, 20, 10].map((label) => (
                    <li key={label}>{label}%</li>
                  ))}
                </ul>
                <div className="chart-area">
                  <svg viewBox="0 0 100 100" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="histogramGradient" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="rgba(255,255,255,0.35)" />
                        <stop offset="100%" stopColor="rgba(255,255,255,0)" />
                      </linearGradient>
                    </defs>
                    <polygon fill="url(#histogramGradient)" points={areaPoints} />
                    <polyline
                      points={polylinePoints}
                      fill="none"
                      stroke="#ffffff"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    {polylinePoints.split(" ").map((point, index) => {
                      if (!point) return null;
                      const [cx, cy] = point.split(",").map(Number);
                      return (
                        <circle
                          key={index}
                          cx={cx}
                          cy={cy}
                          r="2.5"
                          fill="#ffffff"
                          stroke="rgba(12,33,53,0.18)"
                          strokeWidth="0.8"
                        />
                      );
                    })}
                  </svg>
                </div>
              </div>
            </section>

            <ForecastBar items={focusDays} />

            {infoTags.length ? (
              <div className="info-tags">
                {infoTags.map((tag) => (
                  <span key={tag} className="info-tag">
                    {tag}
                  </span>
                ))}
              </div>
            ) : null}
          </>
        ) : (
          <div className="placeholder-card">
            {loading ? "Consultando datos historicos..." : "Selecciona una condicion para ver resultados"}
          </div>
        )}

        <footer className="page-footer">Analizando decadas de datos NASA</footer>
      </div>
    </div>
  );
}
