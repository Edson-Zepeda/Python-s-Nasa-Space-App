const DAY_IN_MS = 86_400_000;
const BASE_YEAR = 2000;

const WEEKDAY_LABELS = ["Dom", "Lun", "Mar", "Mie", "Jue", "Vie", "Sab"];
const WEEKDAY_LABELS_SHORT = ["DOM", "LUN", "MAR", "MIE", "JUE", "VIE", "SAB"];
const MONTH_LABELS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

const DEFAULT_CONDITION_ORDER = ["hot", "cold", "windy", "wet", "muggy"];

const CONDITION_INFO = {
  hot: {
    label: "Muy caliente",
    metrics: ["t2m_max", "hi_max"],
    unitKey: "temp",
    icon: "sunny",
  },
  cold: {
    label: "Muy frio",
    metrics: ["t2m_min", "wc_min"],
    unitKey: "temp",
    icon: "night",
  },
  windy: {
    label: "Muy ventoso",
    metrics: ["wind_speed_max", "wind_gust_p95"],
    unitKey: "wind",
    icon: "windy",
  },
  wet: {
    label: "Muy mojado",
    metrics: ["precip_daily", "precip_rate_max"],
    unitKey: "precip",
    icon: "rainy",
  },
  muggy: {
    label: "Muy incomodo",
    metrics: ["hi_max", "dewpoint_max"],
    unitKey: "temp",
    icon: "cloudy",
  },
};

const DEFAULT_UNITS = {
  temp: "degC",
  precip: "mm",
  wind: "km/h",
  prob: "%",
};

function unitFor(kind, units = {}) {
  if (kind === "temp") return units.temp ?? DEFAULT_UNITS.temp;
  if (kind === "precip") return units.precip ?? DEFAULT_UNITS.precip;
  if (kind === "wind") return units.wind ?? DEFAULT_UNITS.wind;
  return units[kind] ?? "";
}

function toNumber(value) {
  if (value == null) {
    return null;
  }
  const asNumber = Number(value);
  return Number.isFinite(asNumber) ? asNumber : null;
}

function formatThresholdSummary(condition, thresholds = {}, units = {}, logic = "ANY") {
  const joiner = logic === "ALL" ? " y " : " o ";
  const parts = [];
  const tempUnit = unitFor("temp", units);
  const windUnit = unitFor("wind", units);
  const precipUnit = unitFor("precip", units);

  if (condition === "hot") {
    const t = toNumber(thresholds.T_min);
    const hi = toNumber(thresholds.HI_min);
    if (t != null) parts.push(`T >= ${t} ${tempUnit}`);
    if (hi != null) parts.push(`HI >= ${hi} ${tempUnit}`);
  } else if (condition === "cold") {
    const t = toNumber(thresholds.T_max);
    const wc = toNumber(thresholds.WC_max);
    if (t != null) parts.push(`T <= ${t} ${tempUnit}`);
    if (wc != null) parts.push(`WC <= ${wc} ${tempUnit}`);
  } else if (condition === "windy") {
    const v = toNumber(thresholds.V_min);
    const gust = toNumber(thresholds.gust_min);
    if (v != null) parts.push(`V >= ${v} ${windUnit}`);
    if (gust != null) parts.push(`G >= ${gust} ${windUnit}`);
  } else if (condition === "wet") {
    const daily = toNumber(thresholds.P_daily);
    const rate = toNumber(thresholds.P_rate);
    if (daily != null) parts.push(`P >= ${daily} ${precipUnit}`);
    if (rate != null) parts.push(`I >= ${rate} ${precipUnit}/h`);
  } else if (condition === "muggy") {
    const hi = toNumber(thresholds.HI_min);
    const td = toNumber(thresholds.Td_min);
    if (hi != null) parts.push(`HI >= ${hi} ${tempUnit}`);
    if (td != null) parts.push(`Td >= ${td} ${tempUnit}`);
  }

  if (!parts.length) {
    return "Umbrales por defecto";
  }
  return parts.join(joiner);
}

function chooseIcon(condition, probability) {
  if (probability == null) {
    return "cloudy";
  }
  if (condition === "wet") {
    if (probability >= 70) return "rainy";
    if (probability >= 40) return "showers";
    return "cloudy";
  }
  if (condition === "windy") {
    return probability >= 40 ? "windy" : "clear";
  }
  if (condition === "cold") {
    if (probability >= 60) return "night";
    if (probability >= 30) return "cloudy";
    return "clear";
  }
  if (condition === "muggy") {
    if (probability >= 60) return "cloudy";
    if (probability >= 30) return "clear";
    return "sunny";
  }
  return probability >= 50 ? "sunny" : "clear";
}

function safeDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return null;
  }
  return date;
}

function formatCardDate(date) {
  const valid = safeDate(date);
  if (!valid) {
    return "--";
  }
  const day = String(valid.getDate()).padStart(2, "0");
  const month = MONTH_LABELS[valid.getMonth()];
  const year = valid.getFullYear();
  const weekday = WEEKDAY_LABELS[valid.getDay()];
  return `${weekday} ${day} ${month} ${year}`;
}

function normalisedTarget(date) {
  const valid = safeDate(date);
  if (!valid) {
    return Date.UTC(BASE_YEAR, 0, 1);
  }
  return Date.UTC(BASE_YEAR, valid.getMonth(), valid.getDate());
}

function parseTimeseriesDate(value) {
  if (typeof value !== "string") {
    return null;
  }
  const parts = value.split("-");
  if (parts.length < 3) {
    return null;
  }
  const monthIndex = Number(parts[1]) - 1;
  const day = Number(parts[2]);
  if (!Number.isFinite(monthIndex) || !Number.isFinite(day)) {
    return null;
  }
  return { monthIndex, day };
}

function buildTimeline(condition, response, selectedDate) {
  const info = CONDITION_INFO[condition] ?? { metrics: [] };
  const timeseries = Array.isArray(response?.timeseries) ? response.timeseries : [];
  const windowDays = Number.isFinite(response?.window_days) ? response.window_days : 15;
  const targetBase = normalisedTarget(selectedDate);

  const buckets = new Map();

  timeseries.forEach((row) => {
    const parsed = parseTimeseriesDate(row.date);
    if (!parsed) {
      return;
    }
    const dayStamp = Date.UTC(BASE_YEAR, parsed.monthIndex, parsed.day);
    let offset = Math.round((dayStamp - targetBase) / DAY_IN_MS);

    if (offset > windowDays) {
      offset -= 366;
    } else if (offset < -windowDays) {
      offset += 366;
    }

    if (Math.abs(offset) > windowDays) {
      return;
    }

    const entry = buckets.get(offset) ?? { offset, total: 0, exceed: 0, values: [] };

    if (row.exceed === true) {
      entry.exceed += 1;
      entry.total += 1;
    } else if (row.exceed === false) {
      entry.total += 1;
    }

    for (const metric of info.metrics) {
      const candidate = toNumber(row[metric]);
      if (candidate != null) {
        entry.values.push(candidate);
        break;
      }
    }

    buckets.set(offset, entry);
  });

  const offsets = Array.from(buckets.keys()).sort((a, b) => a - b);
  const timelineFull = offsets.map((offset) => {
    const entry = buckets.get(offset);
    const probability =
      entry.total > 0 ? Number(((entry.exceed / entry.total) * 100).toFixed(1)) : null;
    const dayStamp = targetBase + offset * DAY_IN_MS;
    const date = new Date(dayStamp);
    const weekdayIndex = date.getUTCDay();
    const label = `${MONTH_LABELS[date.getUTCMonth()]} ${String(date.getUTCDate()).padStart(
      2,
      "0",
    )}`;

    return {
      offset,
      probability,
      sample: entry.total,
      exceed: entry.exceed,
      label,
      weekday: WEEKDAY_LABELS[weekdayIndex],
      weekdayShort: WEEKDAY_LABELS_SHORT[weekdayIndex],
    };
  });

  const focus =
    timelineFull.length <= 7
      ? timelineFull
      : (() => {
          const pivotIndex = timelineFull.findIndex((item) => item.offset === 0);
          const center = pivotIndex === -1 ? Math.floor(timelineFull.length / 2) : pivotIndex;
          let start = Math.max(0, center - 3);
          let end = Math.min(timelineFull.length, start + 7);
          if (end - start < 7) {
            start = Math.max(0, end - 7);
          }
          return timelineFull.slice(start, end);
        })();

  const chartValues = focus.map((item) => (item.probability ?? 0));
  const chartLabels = focus.map((item) => item.weekdayShort);
  const chartIcons = focus.map((item) => chooseIcon(condition, item.probability));

  return {
    windowDays,
    timelineFull,
    focus,
    chart: {
      values: chartValues,
      labels: chartLabels,
      icons: chartIcons,
    },
  };
}

export function prepareConditionViewData({
  response,
  condition,
  selectedDate,
  locationLabel,
}) {
  if (!response) {
    return null;
  }

  const info = CONDITION_INFO[condition] ?? {
    label: condition,
    metrics: [],
    unitKey: "temp",
    icon: "cloudy",
  };

  const probability = toNumber(response.probability_pct);
  const statsMedian = toNumber(response.stats?.p50);
  const units = response.units ?? {};
  const timeline = buildTimeline(condition, response, selectedDate);
  const thresholdSummary = formatThresholdSummary(
    condition,
    response.thresholds_resolved,
    units,
    response.logic,
  );

  const card = {
    location: locationLabel,
    dateLabel: formatCardDate(selectedDate),
    temperature: {
      value: statsMedian,
      unit: unitFor(info.unitKey, units),
    },
    condition: info.label,
    humidity: probability,
    wind: thresholdSummary,
    histogram: {
      values: timeline.chart.values,
      description: `Ventana +/- ${timeline.windowDays} dias. Muestra ${response.sample?.n_days ?? "--"} dias.`,
      comparison: response.years?.n_years
        ? `${response.years.n_years} anos`
        : response.years?.range ?? "Serie historica",
      labels: timeline.chart.labels,
      icons: timeline.chart.icons,
    },
  };

  return {
    card,
    timelineFull: timeline.timelineFull,
    summary: {
      threshold: thresholdSummary,
      dataset: Array.isArray(response.dataset_used) ? response.dataset_used : [],
      sample: response.sample ?? null,
      windowDays: timeline.windowDays,
      years: response.years ?? null,
      notes: Array.isArray(response.notes) ? response.notes : [],
      logic: response.logic,
      probability,
      generatedAt: response.generated_at,
      queryId: response.query_id,
    },
    probability,
  };
}

export function getConditionList(config) {
  const defined = config?.conditions ? Object.keys(config.conditions) : [];
  const uniqueKeys = new Set([...DEFAULT_CONDITION_ORDER, ...defined]);

  return Array.from(uniqueKeys).map((key) => ({
    key,
    label: config?.conditions?.[key]?.label ?? CONDITION_INFO[key]?.label ?? key,
  }));
}

export const CONDITION_ORDER = DEFAULT_CONDITION_ORDER;

