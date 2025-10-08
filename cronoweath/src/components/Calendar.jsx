import { useMemo } from "react";

const DAY_LABELS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

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

export default function Calendar({
  cursor,
  selectedDate,
  onPrevMonth,
  onNextMonth,
  onSelectDay,
}) {
  const { year, month } = cursor;
  const monthLabel = new Date(year, month).toLocaleString("es-ES", {
    month: "long",
    year: "numeric",
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
    <div className="cwx-calendar">
      <div className="cwx-calendar__header">
        <button type="button" onClick={onPrevMonth} className="cwx-calendar__nav" aria-label="Mes anterior">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19 8 12 15 5" />
          </svg>
        </button>
        <div className="cwx-calendar__month">{monthLabel}</div>
        <button type="button" onClick={onNextMonth} className="cwx-calendar__nav" aria-label="Mes siguiente">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="m9 5 7 7-7 7" />
          </svg>
        </button>
      </div>

      <div className="cwx-calendar__weekdays">
        {DAY_LABELS.map((day) => (
          <div key={day} className="cwx-calendar__weekday">
            {day}
          </div>
        ))}
      </div>

      <div className="cwx-calendar__grid">
        {weeks.map((week, weekIndex) =>
          week.map((day, dayIndex) => {
            const key = `${year}-${month}-${weekIndex}-${dayIndex}`;
            if (!day) {
              return <div key={key} className="cwx-calendar__cell cwx-calendar__cell--empty" />;
            }

            const isSelected = selectedDay === day;
            const isToday = todayDay === day;

            return (
              <button
                key={key}
                type="button"
                onClick={() => onSelectDay(day)}
                className={[
                  "cwx-calendar__cell",
                  isSelected ? "is-selected" : "",
                  !isSelected && isToday ? "is-today" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {String(day).padStart(2, "0")}
              </button>
            );
          }),
        )}
      </div>
    </div>
  );
}
