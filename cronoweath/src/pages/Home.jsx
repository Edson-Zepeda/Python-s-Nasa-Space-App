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
    <div className="min-h-screen bg-[#9fbac3] flex justify-center">
      <div className="relative w-[1920px] h-[1080px]">
        <h1
          className="absolute left-[267px] top-[210px] text-[128px] font-outfit font-extrabold uppercase tracking-[0.35em] text-[#F4F7F8] drop-shadow-[0_0_25px_rgba(255,255,255,0.55)]"
        >
          CRONOWEATH
        </h1>
      </div>
    </div>
  );
}
