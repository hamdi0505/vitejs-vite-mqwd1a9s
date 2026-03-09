import { useEffect, useMemo, useState } from "react";
import { getCalendarDays, getMonthNameDE } from "../services/calendarService";
import {
  getClosedDaysInRange,
  addClosedDay,
  removeClosedDay,
  getWeekdaySettings,
  getSickDaysInRange,
  getWorkers
} from "../services/supabaseService";
import { getHolidaysForMonth } from "../services/holidaysService";
import { on, EVENTS } from "../services/eventBus";

const WEEKDAYS_DE = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const WEEKDAYS_FULL_DE = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];

function MonthSelector({ onChange }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const [closedDaysSet, setClosedDaysSet] = useState(new Set());
  const [holidaysMap, setHolidaysMap] = useState({});
  const [weekdayClosed, setWeekdayClosed] = useState({
    0: false, 1: false, 2: false, 3: false, 4: false, 5: false, 6: false
  });

  // sickDaysByDate: { "YYYY-MM-DD": [workerId, ...] }
  const [sickDaysByDate, setSickDaysByDate] = useState({});
  // workerNameById: { workerId: "Name" }
  const [workerNameById, setWorkerNameById] = useState({});

  const calendarDays = useMemo(() => getCalendarDays(year, month), [year, month]);

  const monthRange = useMemo(() => {
    const first = calendarDays.find((d) => d.inMonth)?.date;
    const last = [...calendarDays].reverse().find((d) => d.inMonth)?.date;
    return { first, last };
  }, [calendarDays]);

  async function reloadWorkers() {
    const workers = await getWorkers();
    const map = {};
    workers.forEach((w) => (map[w.id] = w.name));
    setWorkerNameById(map);
  }

  async function reloadWeekdayClosed() {
    const settings = await getWeekdaySettings();
    const next = { 0: false, 1: false, 2: false, 3: false, 4: false, 5: false, 6: false };
    settings.forEach((s) => {
      if (typeof s.weekday === "number") next[s.weekday] = Boolean(s.is_closed);
    });
    setWeekdayClosed(next);
  }

  async function reloadMarkers() {
    if (!monthRange.first || !monthRange.last) return;

    const closed = await getClosedDaysInRange(monthRange.first, monthRange.last);
    setClosedDaysSet(new Set(closed.map((c) => c.date)));

    try {
      const hol = await getHolidaysForMonth(year, month);
      setHolidaysMap(hol || {});
    } catch {
      setHolidaysMap({});
    }

    const sick = await getSickDaysInRange(monthRange.first, monthRange.last);
    const byDate = {};
    sick.forEach((s) => {
      if (!byDate[s.date]) byDate[s.date] = [];
      byDate[s.date].push(s.worker_id);
    });
    setSickDaysByDate(byDate);
  }

  useEffect(() => {
    reloadWorkers();
    reloadWeekdayClosed();
  }, []);

  useEffect(() => {
    reloadMarkers();
  }, [year, month, monthRange.first, monthRange.last]);

  useEffect(() => {
    const unsub = on(EVENTS.DATA_CHANGED, (info) => {
      const t = info?.table;
      if (t === "workers") reloadWorkers();
      if (t === "settings") reloadWeekdayClosed();
      if (t === "closed_days" || t === "sick_days" || t === "settings") reloadMarkers();
    });
    return unsub;
  }, [year, month, monthRange.first, monthRange.last]);

  useEffect(() => {
    if (onChange) onChange({ year, month, days: calendarDays });
  }, [year, month, calendarDays, onChange]);

  function isAutoClosedByWeekday(dayObj) {
    if (!dayObj?.inMonth) return false;
    if (dayObj.weekday == null) return false;
    return Boolean(weekdayClosed[dayObj.weekday]);
  }

  function getStatuses(dayObj) {
    // liefert Array in fester Reihenfolge (fair + konsistent)
    // ["closed","holiday","sick"] je nach Status
    if (!dayObj?.date) return [];

    const statuses = [];

    const isManualClosed = closedDaysSet.has(dayObj.date);
    const isAutoClosed = isAutoClosedByWeekday(dayObj);
    if (isManualClosed || isAutoClosed) statuses.push("closed");

    if (holidaysMap[dayObj.date]) statuses.push("holiday");

    const sickIds = sickDaysByDate[dayObj.date] || [];
    if (sickIds.length > 0) statuses.push("sick");

    return statuses;
  }

  function getCircleBackground(statuses) {
    // Fair: gleiche Segmente pro Status
    // 1 Status -> Vollfarbe
    // 2 Status -> 50/50
    // 3 Status -> 33/33/33
    const colors = statuses.map((s) => STATUS_COLORS[s]).filter(Boolean);

    if (colors.length === 0) return "transparent";
    if (colors.length === 1) return colors[0];

    const step = 100 / colors.length;
    const parts = colors.map((c, i) => {
      const start = (i * step).toFixed(2);
      const end = ((i + 1) * step).toFixed(2);
      return `${c} ${start}% ${end}%`;
    });

    // conic-gradient macht “Tortenstücke”
    return `conic-gradient(${parts.join(", ")})`;
  }

  async function toggleClosedDay(date) {
    if (holidaysMap[date]) return;

    if (closedDaysSet.has(date)) {
      await removeClosedDay(date);
    } else {
      await addClosedDay(date);
    }
    // refresh via eventBus
  }

  function explainDay(dayObj) {
    if (!dayObj?.date) return;

    const statuses = getStatuses(dayObj);
    if (statuses.length === 0) {
      alert("Normaler Tag");
      return;
    }

    const lines = [];

    // closed
    const isManualClosed = closedDaysSet.has(dayObj.date);
    const isAutoClosed = isAutoClosedByWeekday(dayObj);

    if (statuses.includes("closed")) {
      if (isManualClosed) lines.push("• Geschlossen (manuell)");
      else if (isAutoClosed) lines.push(`• Geschlossen (automatisch: ${WEEKDAYS_FULL_DE[dayObj.weekday]})`);
      else lines.push("• Geschlossen");
    }

    // holiday
    if (statuses.includes("holiday")) {
      lines.push(`• Feiertag: ${holidaysMap[dayObj.date]}`);
    }

    // sick
    if (statuses.includes("sick")) {
      const ids = sickDaysByDate[dayObj.date] || [];
      const names = ids.map((id) => workerNameById[id] || id);
      lines.push(`• Krank: ${names.join(", ")}`);
    }

    alert(lines.join("\n"));
  }

  return (
    <div style={{ marginTop: "20px" }}>
      <h2>Monat auswählen</h2>

      <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "12px" }}>
        <label style={labelStyle}>
          Jahr
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            style={inputStyle}
          />
        </label>

        <label style={labelStyle}>
          Monat
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            style={inputStyle}
          >
            {Array.from({ length: 12 }).map((_, i) => {
              const m = i + 1;
              return (
                <option key={m} value={m}>
                  {getMonthNameDE(m)}
                </option>
              );
            })}
          </select>
        </label>
      </div>

      <div style={calendarWrapperStyle}>
        <div style={weekdayRowStyle}>
          {WEEKDAYS_DE.map((w) => (
            <div key={w} style={weekdayCellStyle}>{w}</div>
          ))}
        </div>

        <div style={gridStyle}>
          {calendarDays.map((d, idx) => {
            const statuses = d.inMonth ? getStatuses(d) : [];

            return (
              <div
                key={idx}
                style={{
                  ...dayCellStyle,
                  opacity: d.inMonth ? 1 : 0.2
                }}
                onClick={() => d.inMonth && explainDay(d)}
              >
                {d.inMonth ? (
                  <div
                    style={{
                      ...circleStyle,
                      background: getCircleBackground(statuses)
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      toggleClosedDay(d.date);
                    }}
                  >
                    {d.day}
                  </div>
                ) : (
                  ""
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ marginTop: "10px", fontSize: "13px" }}>
        <div style={{ fontWeight: 600, marginBottom: "6px" }}>Legende</div>

        <div style={legendRowStyle}>
          <span style={{ ...legendDotStyle, background: STATUS_COLORS.closed }} />
          <span>Geschlossen (rot)</span>
        </div>

        <div style={legendRowStyle}>
          <span style={{ ...legendDotStyle, background: STATUS_COLORS.holiday }} />
          <span>Feiertag (gelb)</span>
        </div>

        <div style={legendRowStyle}>
          <span style={{ ...legendDotStyle, background: STATUS_COLORS.sick }} />
          <span>Krank (blau)</span>
        </div>

        <div style={{ marginTop: "8px", fontSize: "12px", opacity: 0.8 }}>
          Tipp: Wenn mehrere Regeln an einem Tag gelten, wird der Kreis in gleich große Farbsegmente geteilt.
        </div>
      </div>
    </div>
  );
}

const STATUS_COLORS = {
  closed: "#ffb3b3",
  holiday: "#ffe58a",
  sick: "#9fd0ff"
};

const labelStyle = { display: "flex", flexDirection: "column", fontSize: "13px", gap: "4px" };
const inputStyle = { padding: "4px", fontSize: "14px" };

const calendarWrapperStyle = { width: "100%", border: "1px solid black" };

const weekdayRowStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(7, 1fr)",
  borderBottom: "1px solid black",
  backgroundColor: "#f0f0f0"
};

const weekdayCellStyle = {
  padding: "6px 4px",
  fontSize: "12px",
  borderRight: "1px solid black",
  textAlign: "center"
};

const gridStyle = { display: "grid", gridTemplateColumns: "repeat(7, 1fr)" };

const dayCellStyle = {
  minHeight: "42px",
  borderRight: "1px solid black",
  borderBottom: "1px solid black",
  padding: "4px",
  fontSize: "13px",
  textAlign: "center",
  display: "flex",
  alignItems: "center",
  justifyContent: "center"
};

const circleStyle = {
  width: "28px",
  height: "28px",
  borderRadius: "999px",
  border: "1px solid black",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  userSelect: "none"
};

const legendRowStyle = { display: "flex", gap: "8px", alignItems: "center", marginBottom: "6px" };

const legendDotStyle = {
  width: "14px",
  height: "14px",
  borderRadius: "999px",
  border: "1px solid black",
  display: "inline-block"
};

export default MonthSelector;