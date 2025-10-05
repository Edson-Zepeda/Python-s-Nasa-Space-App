import { useMemo, useState } from "react";
import Calendar from "../components/Calendar.jsx";
import ResultsCard from "../components/ResultsCard.jsx";

const LOCATIONS = [
  "Mexico",
  "Malaysia",
  "Morocco",
  "Madrid",
  "Melbourne",
  "Montreal",
];

const HISTOGRAM_TEMPLATE = {
  values: [45, 70, 58, 82, 76, 64, 55],
  labels: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  icons: ["sunny", "showers", "windy", "rainy", "cloudy", "clear", "night"],
  comparison: "A year ago",
  description: "Weekly anomaly index",
};

function normalizeLocationLabel(value) {
  return value
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function formatDisplayDate(date) {
  const day = String(date.getDate()).padStart(2, "0");
  const month = date.toLocaleString("en-US", { month: "long" });
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
}

function formatInputDate(date) {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

function getInitialCursor() {
  const today = new Date();
  return { month: today.getMonth(), year: today.getFullYear() };
}

export default function Home() {
  const [query, setQuery] = useState("");
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [calendarCursor, setCalendarCursor] = useState(getInitialCursor);

  const filteredLocations = useMemo(() => {
    if (!query.trim()) {
      return LOCATIONS.slice(0, 4);
    }

    const lower = query.trim().toLowerCase();
    return LOCATIONS.filter((location) => location.toLowerCase().includes(lower)).slice(0, 5);
  }, [query]);

  const showSuggestions = query.trim().length > 0 && !selectedLocation;
  const displayDate = selectedDate ? formatInputDate(selectedDate) : "DD/MM/YYYY";

  const weatherData = useMemo(() => {
    if (!selectedLocation || !selectedDate) {
      return null;
    }

    return {
      location: normalizeLocationLabel(selectedLocation),
      dateLabel: formatDisplayDate(selectedDate),
      temperature: { value: 25, unit: "\u00B0C" },
      condition: "Very windy",
      humidity: 88,
      wind: "Gusts up to 35 km/h",
      histogram: HISTOGRAM_TEMPLATE,
    };
  }, [selectedLocation, selectedDate]);

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!query.trim()) {
      return;
    }

    setSelectedLocation(query.trim());
    setSelectedDate(null);
    setIsCalendarOpen(true);
  };

  const handleSelectLocation = (value) => {
    setSelectedLocation(value);
    setQuery(value);
    setSelectedDate(null);
    setIsCalendarOpen(true);
  };

  const handleLocationInput = (event) => {
    const nextValue = event.target.value;
    setQuery(nextValue);

    if (!nextValue.trim()) {
      setSelectedLocation(null);
      setSelectedDate(null);
      setIsCalendarOpen(false);
    } else {
      setSelectedLocation(null);
      setSelectedDate(null);
    }
  };

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
    const date = new Date(calendarCursor.year, calendarCursor.month, day);
    setSelectedDate(date);
    setIsCalendarOpen(false);
  };

  const resetFlow = () => {
    setQuery("");
    setSelectedLocation(null);
    setSelectedDate(null);
    setIsCalendarOpen(false);
    setCalendarCursor(getInitialCursor());
  };

  return (
    <div className="min-h-screen bg-chrono-sky px-4 py-12 text-chrono-text">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col items-center justify-center gap-10">
        <div className="text-center">
          <h1 className="text-5xl font-extrabold uppercase tracking-[0.45em] text-white drop-shadow-glow sm:text-6xl">
            Cronoweath
          </h1>
        </div>

        <form
          onSubmit={handleSubmit}
          className="w-full max-w-3xl rounded-[36px] border border-white/70 bg-white/70 p-2 shadow-glass backdrop-blur"
        >
          <div className="relative flex items-center">
            <span className="pointer-events-none absolute left-4 text-slate-500">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                className="h-5 w-5"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35" />
                <circle cx="11" cy="11" r="6.25" />
              </svg>
            </span>
            <input
              value={query}
              onChange={handleLocationInput}
              placeholder="Enter a location (e.g., Paris, Mexico, your city, etc.)"
              className="h-16 w-full rounded-[32px] bg-white/75 pl-14 pr-16 text-base font-medium text-slate-700 outline-none transition focus:ring-4 focus:ring-white/60"
            />
            <button
              type="submit"
              className="absolute right-3 grid h-12 w-12 place-items-center rounded-2xl bg-white/90 text-slate-600 transition hover:bg-white"
              aria-label="Search location"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="h-5 w-5"
              >
                <path d="M9 4.5a4.5 4.5 0 1 1-2.513 8.216L4.97 13.5l.707.707 1.515-1.515A4.5 4.5 0 1 1 9 4.5Z" />
              </svg>
            </button>
          </div>
        </form>

        {showSuggestions ? (
          <div className="w-full max-w-3xl rounded-[32px] border border-white/70 bg-white/70 shadow-glass backdrop-blur">
            <button
              type="button"
              className="flex w-full items-center justify-between rounded-t-[32px] px-6 py-4 text-left text-sm font-medium text-slate-600 transition hover:bg-white"
              onClick={() => handleSelectLocation("Current location")}
            >
              <span>Your current location</span>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                className="h-5 w-5"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            </button>
            <div className="h-px bg-white/70" />
            {filteredLocations.map((location) => (
              <button
                key={location}
                type="button"
                onClick={() => handleSelectLocation(location)}
                className="flex w-full items-center px-6 py-3 text-left text-base font-medium text-slate-600 transition hover:bg-white"
              >
                {normalizeLocationLabel(location)}
              </button>
            ))}
          </div>
        ) : null}

        {selectedLocation ? (
          <div className="relative w-full max-w-3xl">
            <button
              type="button"
              onClick={() => setIsCalendarOpen((value) => !value)}
              className="flex w-full items-center justify-between rounded-[32px] border border-white/70 bg-white/70 px-6 py-4 text-left text-base font-semibold text-slate-600 shadow-glass backdrop-blur transition hover:bg-white"
            >
              <span>{displayDate}</span>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="h-5 w-5"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 6.75v-2A1.75 1.75 0 0 1 9.25 3h5.5A1.75 1.75 0 0 1 16.5 4.75v2" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.75 8.5A1.75 1.75 0 0 1 6.5 6.75h11a1.75 1.75 0 0 1 1.75 1.75V18A3 3 0 0 1 16.25 21h-8.5A3 3 0 0 1 4.75 18Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.5 13h7" />
              </svg>
            </button>

            {isCalendarOpen ? (
              <div className="absolute left-0 right-0 top-[110%] z-10">
                <Calendar
                  cursor={calendarCursor}
                  selectedDate={selectedDate}
                  onPrevMonth={handlePrevMonth}
                  onNextMonth={handleNextMonth}
                  onSelectDay={handleSelectDay}
                />
              </div>
            ) : null}
          </div>
        ) : null}

        {weatherData ? (
          <div className="w-full max-w-4xl">
            <ResultsCard data={weatherData} />
          </div>
        ) : null}

        <div className="flex w-full max-w-3xl flex-wrap items-center justify-between gap-4 text-sm text-slate-600">
          <p className="text-xs uppercase tracking-[0.35em] text-slate-600/80">
            Analyzing decades of NASA data.
          </p>
          {(selectedLocation || selectedDate) ? (
            <button
              type="button"
              onClick={resetFlow}
              className="rounded-full border border-white/70 bg-white/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-slate-600 transition hover:border-white hover:bg-white"
            >
              Start over
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
