import ResultsCard from "./ResultsCard.jsx";

function formatCoordinate(value) {
  if (!Number.isFinite(value)) {
    return null;
  }
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)} deg`;
}

function LocationMeta({ location }) {
  if (!location) {
    return null;
  }

  const chips = [
    location.lat != null ? `Lat ${formatCoordinate(location.lat)}` : null,
    location.lon != null ? `Lon ${formatCoordinate(location.lon)}` : null,
    location.timezone ? `Zona horaria ${location.timezone}` : null,
    location.admin1 && location.country
      ? `${location.admin1}, ${location.country}`
      : location.country ?? null,
    location.elevation != null ? `Altitud ${location.elevation} m` : null,
  ].filter(Boolean);

  if (!chips.length) {
    return null;
  }

  return (
    <ul className="flex flex-wrap gap-2">
      {chips.map((item) => (
        <li
          key={item}
          className="rounded-full bg-white/50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-slate-600 shadow-inset"
        >
          {item}
        </li>
      ))}
    </ul>
  );
}

function ConditionTabs({ conditions, active, onSelect, results, loading }) {
  if (!conditions.length) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {conditions.map(({ key, label }) => {
        const entry = results[key];
        const probability =
          entry && entry.probability != null ? Number(entry.probability).toFixed(1) : "--";
        const status = entry?.status ?? "idle";
        const isActive = key === active;
        const disabled = loading && !isActive;

        return (
          <button
            key={key}
            type="button"
            onClick={() => onSelect(key)}
            disabled={disabled}
            className={[
              "flex items-center gap-3 rounded-full border px-4 py-2 text-sm font-semibold uppercase tracking-[0.3em] transition",
              isActive
                ? "border-white bg-white text-slate-800 shadow-lg"
                : "border-white/60 bg-white/60 text-slate-600 hover:bg-white",
            ].join(" ")}
          >
            <span>{label}</span>
            <span className="text-xs text-slate-500">
              {status === "insufficient" ? "Sin muestra" : `${probability}%`}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function SummarySection({ summary }) {
  if (!summary) {
    return null;
  }

  const chips = [];
  if (summary.sample?.n_days != null) {
    chips.push(`Muestra ${summary.sample.n_days} dias`);
  }
  if (summary.sample?.coverage_pct != null) {
    chips.push(`Cobertura ${summary.sample.coverage_pct}%`);
  }
  if (summary.windowDays != null) {
    chips.push(`Ventana +/- ${summary.windowDays} dias`);
  }
  if (summary.years?.range) {
    chips.push(`Rango ${summary.years.range}`);
  }
  if (summary.logic) {
    chips.push(`Logica ${summary.logic}`);
  }

  return (
    <section className="rounded-[32px] border border-white/60 bg-white/70 p-6 shadow-lg">
      <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-500">
        Detalles del calculo
      </p>
      <p className="mt-2 text-sm text-slate-600">{summary.threshold}</p>

      {chips.length ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {chips.map((chip) => (
            <span
              key={chip}
              className="rounded-full bg-white px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.3em] text-slate-600 shadow-inset"
            >
              {chip}
            </span>
          ))}
        </div>
      ) : null}

      {summary.dataset?.length ? (
        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
            Datasets
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {summary.dataset.map((name) => (
              <span
                key={name}
                className="rounded-full border border-[#7A6BFF]/40 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-[#5a4de1]"
              >
                {name}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {summary.notes?.length ? (
        <div className="mt-4 text-sm text-slate-600">
          <ul className="list-disc pl-6">
            {summary.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-4 text-xs text-slate-400">
        {summary.generatedAt ? <p>Generado: {summary.generatedAt}</p> : null}
        {summary.queryId ? <p>ID consulta: {summary.queryId}</p> : null}
      </div>
    </section>
  );
}

function Chronogram({ items, windowDays }) {
  if (!items?.length) {
    return null;
  }

  return (
    <section className="rounded-[32px] border border-white/60 bg-white/70 p-6 shadow-lg">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-500">
            Cronograma
          </p>
          <p className="text-sm text-slate-600">
            Ventana +/- {windowDays} dias — Probabilidad diaria (%)
          </p>
        </div>
      </div>

      <div className="mt-4 flex gap-3 overflow-x-auto pb-2">
        {items.map((item) => (
          <div
            key={item.offset}
            className={[
              "min-w-[96px] flex-shrink-0 rounded-3xl border border-white/70 px-3 py-4 text-center shadow-inset transition",
              item.offset === 0
                ? "bg-[#7A6BFF] text-white"
                : "bg-white/90 text-slate-700 hover:bg-white",
            ].join(" ")}
          >
            <p className="text-xs font-semibold uppercase tracking-[0.3em]">
              {item.weekdayShort}
            </p>
            <p className="text-sm font-medium">{item.label}</p>
            <p className="mt-2 text-2xl font-extrabold">
              {item.probability != null ? `${item.probability.toFixed(1)}%` : "--"}
            </p>
            <p
              className={[
                "text-[0.65rem] tracking-[0.2em]",
                item.offset === 0 ? "text-white/80" : "text-slate-400",
              ].join(" ")}
            >
              {item.sample ?? 0} dias
            </p>
          </div>
        ))}
      </div>
    </section>
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
    formatCoordinate(location?.lat),
    formatCoordinate(location?.lon),
  ]
    .filter(Boolean)
    .join(", ");

  const locationLabel = location?.label ?? (fallbackLabel || "--");

  const activeEntry = activeCondition ? results[activeCondition] : null;
  const cardData = activeEntry?.status === "ok" ? activeEntry.view.card : null;
  const summary = activeEntry?.status === "ok" ? activeEntry.view.summary : null;
  const timelineFull =
    activeEntry?.status === "ok" ? activeEntry.view.timelineFull : [];
  const insufficient = activeEntry?.status === "insufficient";
  const errorMessage = activeEntry?.status === "error" ? activeEntry.message : null;

  return (
    <div className="min-h-screen bg-[#9fbac3] pb-12 text-slate-900">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 md:px-6 lg:px-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.45em] text-white/80">
              Resultados historicos NASA
            </p>
            <h1 className="text-4xl font-extrabold text-white drop-shadow-xl md:text-5xl">
              CRONOWEATH
            </h1>
            <p className="mt-2 text-base font-medium text-white/80">{locationLabel}</p>
            <div className="mt-3">
              <LocationMeta location={location} />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-full bg-white/80 px-4 py-2 text-sm font-semibold uppercase tracking-[0.3em] text-slate-700 shadow">
              {cardData?.dateLabel ?? "--"}
            </div>
            <button
              type="button"
              onClick={onBack}
              className="rounded-full border border-white/80 bg-white/90 px-4 py-2 text-xs font-semibold uppercase tracking-[0.4em] text-slate-600 transition hover:bg-white"
            >
              Cambiar fecha
            </button>
          </div>
        </header>

        <ConditionTabs
          conditions={conditions}
          active={activeCondition}
          onSelect={onSelectCondition}
          results={results}
          loading={loading}
        />

        {error ? (
          <div className="rounded-3xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 shadow">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span>{error}</span>
              <button
                type="button"
                onClick={onRetry}
                className="rounded-full border border-red-400 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-red-700 hover:bg-red-100"
              >
                Reintentar
              </button>
            </div>
          </div>
        ) : null}

        {errorMessage ? (
          <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700 shadow">
            <span>{errorMessage}</span>
          </div>
        ) : null}

        {insufficient ? (
          <div className="rounded-3xl border border-slate-200 bg-white/70 p-6 text-sm text-slate-600 shadow">
            No hay muestra suficiente para calcular esta condicion en la ventana seleccionada.
          </div>
        ) : null}

        {loading && !cardData ? (
          <div className="rounded-3xl border border-white/60 bg-white/50 p-8 text-center text-sm font-semibold uppercase tracking-[0.4em] text-slate-600 shadow">
            Consultando datos de la NASA...
          </div>
        ) : null}

        {cardData ? <ResultsCard data={cardData} /> : null}

        <SummarySection summary={summary} />
        <Chronogram items={timelineFull} windowDays={summary?.windowDays ?? 0} />

        <footer className="pt-4 text-center text-xs font-semibold uppercase tracking-[0.4em] text-white/80">
          Analizando decadas de datos NASA
        </footer>
      </div>
    </div>
  );
}
