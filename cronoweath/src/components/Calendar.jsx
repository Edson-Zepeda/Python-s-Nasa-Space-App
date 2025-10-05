import { useMemo } from "react";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function buildCalendar(year, month) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7;
  const days = [];

  for (let index = 0; index < totalCells; index += 1) {
    const dayNumber = index - firstDay + 1;
    if (dayNumber < 1 || dayNumber > daysInMonth) {
      days.push(null);
    } else {
      days.push(dayNumber);
    }
  }

  const weeks = [];
  for (let cursor = 0; cursor < days.length; cursor += 7) {
    weeks.push(days.slice(cursor, cursor + 7));
  }

  return weeks;
}

function classNames(...classes) {
  return classes.filter(Boolean).join(" ");
}

export default function Calendar({
  cursor,
  selectedDate,
  onPrevMonth,
  onNextMonth,
  onSelectDay,
}) {
  const { year, month } = cursor;
  const monthLabel = new Date(year, month).toLocaleString("en-US", {
    month: "long",
  });

  const weeks = useMemo(() => buildCalendar(year, month), [year, month]);
  const selectedDay =
    selectedDate &&
    selectedDate.getFullYear() === year &&
    selectedDate.getMonth() === month
      ? selectedDate.getDate()
      : null;

  const today = new Date();
  const todayDay =
    today.getFullYear() === year && today.getMonth() === month
      ? today.getDate()
      : null;

  return (
    <div className="rounded-[32px] border border-white/60 bg-white/80 p-6 shadow-glass backdrop-blur">
      <div className="mb-6 flex items-center justify-between text-slate-600">
        <button
          type="button"
          onClick={onPrevMonth}
          className="grid h-10 w-10 place-items-center rounded-2xl border border-white/70 bg-white/80 text-slate-600 transition hover:border-white hover:bg-white"
          aria-label="Previous month"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            className="h-4 w-4"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.5 19.5 8 12l7.5-7.5" />
          </svg>
        </button>
        <div className="text-lg font-semibold text-slate-700">
          {monthLabel} {year}
        </div>
        <button
          type="button"
          onClick={onNextMonth}
          className="grid h-10 w-10 place-items-center rounded-2xl border border-white/70 bg-white/80 text-slate-600 transition hover:border-white hover:bg-white"
          aria-label="Next month"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            className="h-4 w-4"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="m8.5 4.5 7.5 7.5-7.5 7.5" />
          </svg>
        </button>
      </div>

      <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
        {DAY_LABELS.map((day) => (
          <div key={day} className="py-1">
            {day}
          </div>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-7 gap-2">
        {weeks.map((week, weekIndex) => (
          week.map((day, dayIndex) => {
            const key = `${year}-${month}-${weekIndex}-${dayIndex}`;
            if (!day) {
              return <div key={key} className="h-12" />;
            }

            const isSelected = selectedDay === day;
            const isToday = todayDay === day;

            return (
              <button
                key={key}
                type="button"
                onClick={() => onSelectDay(day)}
                className={classNames(
                  "flex h-12 flex-col items-center justify-center rounded-3xl border border-transparent bg-white/70 text-sm font-medium text-slate-600 transition",
                  "shadow-inset hover:border-white hover:bg-white hover:text-slate-700",
                  isSelected && "border-[#7566FF] bg-[#7566FF]/10 text-[#5C4FF7] drop-shadow-glow",
                  !isSelected && isToday && "border-white/80 text-slate-700"
                )}
              >
                <span>{String(day).padStart(2, "0")}</span>
                {isToday && !isSelected ? (
                  <span className="text-[10px] font-medium uppercase text-slate-400">Today</span>
                ) : null}
              </button>
            );
          })
        ))}
      </div>
    </div>
  );
}
