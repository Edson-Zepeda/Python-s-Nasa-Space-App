function buildPolylinePoints(values) {
  if (!values.length) {
    return '';
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
    .join(' ');
}

function buildAreaPoints(values) {
  if (!values.length) {
    return '';
  }

  const polyline = buildPolylinePoints(values);
  const first = `0,100`;
  const last = `100,100`;
  return `${first} ${polyline} ${last}`;
}

function renderIcon(name) {
  const baseProps = {
    xmlns: "http://www.w3.org/2000/svg",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.4,
    className: "h-6 w-6",
  };

  switch (name) {
    case "sunny":
      return (
        <svg {...baseProps}>
          <circle cx="12" cy="12" r="4" />
          <path strokeLinecap="round" d="M12 3v2M12 19v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M3 12h2M19 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
        </svg>
      );
    case "showers":
      return (
        <svg {...baseProps}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M7 17.5L5.5 20M11 17.5L9.5 20M15 17.5L13.5 20" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M7 15h9a4 4 0 0 0 0-8 5 5 0 0 0-9.7-1.4A3.5 3.5 0 0 0 7 15Z" />
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
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 17l-1 3M12 17l-1 3M16 17l-1 3" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M7 15h9a4 4 0 0 0 0-8 5 5 0 0 0-9.7-1.4A3.5 3.5 0 0 0 7 15Z" />
        </svg>
      );
    case "cloudy":
      return (
        <svg {...baseProps}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 16h10a4 4 0 0 0 0-8 5 5 0 0 0-9.7-1.4A3.5 3.5 0 0 0 6 16Z" />
        </svg>
      );
    case "clear":
      return (
        <svg {...baseProps}>
          <circle cx="9" cy="12" r="4" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 12a4 4 0 0 0 7 2.6 4.5 4.5 0 0 1-6-6.2 4 4 0 0 0-1 3.6Z" />
        </svg>
      );
    case "night":
      return (
        <svg {...baseProps}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.5 3a6.5 6.5 0 1 0 6.5 6.5 4.5 4.5 0 0 1-6.5-6.5Z" />
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

export default function ResultsCard({ data }) {
  const {
    location,
    dateLabel,
    temperature,
    condition,
    humidity,
    wind,
    histogram,
  } = data;

  const temperatureValue = Number.isFinite(temperature?.value)
    ? Number(temperature.value)
    : null;
  const temperatureLabel = temperatureValue != null ? temperatureValue.toFixed(1) : "--";
  const temperatureUnit = temperatureValue != null ? temperature?.unit ?? "" : "";

  const humidityValue = Number.isFinite(Number(humidity)) ? Number(humidity) : null;
  const humidityLabel = humidityValue != null ? humidityValue.toFixed(1) : "--";

  const polylinePoints = buildPolylinePoints(histogram.values);
  const areaPoints = buildAreaPoints(histogram.values);

  return (
    <section className="rounded-[40px] border border-white/70 bg-white/60 p-8 text-chrono-text shadow-glass backdrop-blur">
      <header className="mb-6 flex items-center justify-between">
        <h2 className="text-2xl font-extrabold tracking-wide text-white drop-shadow-glow">
          CRONOWEATH
        </h2>
        <button
          type="button"
          className="flex items-center gap-2 rounded-full bg-white/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.4em] text-slate-500 transition hover:bg-white"
        >
          <span>Status</span>
          <span className="relative inline-flex h-3 w-6 items-center rounded-full bg-slate-300">
            <span className="absolute right-0 h-3 w-3 rounded-full bg-[#7A6BFF]" />
          </span>
        </button>
      </header>

      <div className="rounded-[32px] border-2 border-[#8E7BFF] bg-white/70 p-6 shadow-glass">
        <div className="grid gap-6 md:grid-cols-[1.4fr_auto_auto] md:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-500">
              Location
            </p>
            <p className="mt-2 text-3xl font-extrabold text-slate-800 md:text-4xl">
              {location}
            </p>
          </div>

          <div className="text-left md:text-right">
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-500">
              Date
            </p>
            <p className="mt-2 text-lg font-semibold text-slate-700 md:text-xl">
              {dateLabel}
            </p>
          </div>

          <div className="flex items-center gap-4 justify-self-start md:justify-self-end">
            <div className="grid h-12 w-12 place-items-center rounded-full bg-white/90 text-slate-500 shadow-inset">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="h-6 w-6"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 11.5c1.5-.8 3.5-.8 6 0s4.5.8 6 0 3.5-.8 6 0"
                />
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 15.5c1.5-.8 3.5-.8 6 0s4.5.8 6 0" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 7.5c1.5-.8 3.5-.8 6 0s4.5.8 6 0" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-500">
                Temp
              </p>
              <p className="mt-1 text-3xl font-extrabold text-slate-800">
                {temperatureLabel}
                {temperatureUnit ? (
                  <span className="text-base font-semibold text-slate-500">
                    {" "}
                    {temperatureUnit}
                  </span>
                ) : null}
              </p>
              <p className="text-[11px] uppercase tracking-[0.32em] text-slate-400">
                Estimated average grades
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 grid gap-6 md:grid-cols-[1.2fr_1fr]">
        <div className="rounded-[28px] border border-white/70 bg-white/70 p-6 shadow-inset">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-500">
            Condition
          </p>
          <p className="mt-3 text-3xl font-extrabold text-slate-800 md:text-4xl">
            {condition}
          </p>
          <div className="mt-4 flex items-center gap-2 text-sm text-slate-500">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="h-5 w-5"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 12h16M4 16h10M4 8h8" />
            </svg>
            <span>{wind}</span>
          </div>
        </div>

        <div className="rounded-[28px] border border-white/70 bg-white/70 p-6 text-right shadow-inset">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-500">
            Probability
          </p>
          <p className="mt-3 text-5xl font-extrabold text-slate-800">
            {humidityLabel}
            {humidityValue != null ? "%" : ""}
          </p>
          <p className="text-xs font-medium uppercase tracking-[0.35em] text-slate-400">
            Serie historica
          </p>
        </div>
      </div>

      <div className="mt-8 rounded-[32px] border border-white/70 bg-white/70 p-6 shadow-inset">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-500">
              Histogram
            </p>
            <p className="text-sm text-slate-500">{histogram.description}</p>
          </div>
          <button
            type="button"
            className="rounded-full border border-white/70 bg-white/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.35em] text-slate-500 transition hover:border-white hover:bg-white"
          >
            {histogram.comparison}
          </button>
        </div>

        <div className="mt-6 h-48 rounded-3xl bg-gradient-to-br from-white/90 to-white/60 p-6 shadow-inner">
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="h-full w-full text-[#7A6BFF]"
          >
            <defs>
              <linearGradient id="histogramGradient" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="rgba(122, 107, 255, 0.28)" />
                <stop offset="100%" stopColor="rgba(122, 107, 255, 0)" />
              </linearGradient>
            </defs>
            <polygon fill="url(#histogramGradient)" points={areaPoints} />
            <polyline
              points={polylinePoints}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <div className="mt-4 grid grid-cols-7 gap-3 text-center text-xs font-semibold uppercase text-slate-500">
          {histogram.labels.map((label, index) => (
            <div key={label} className="flex flex-col items-center gap-1 rounded-2xl bg-white/80 py-2 shadow-inset">
              <span className="text-slate-600">{renderIcon(histogram.icons[index])}</span>
              <span className="tracking-[0.3em]">{label}</span>
            </div>
          ))}
        </div>
      </div>

      <p className="mt-8 text-center text-xs uppercase tracking-[0.45em] text-slate-500">
        Analyzing decades of NASA data.
      </p>
    </section>
  );
}
