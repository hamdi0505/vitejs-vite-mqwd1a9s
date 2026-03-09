import { useEffect, useMemo, useState } from "react";
import {
  addClosedDay,
  getClosedDaysInRange,
  removeClosedDay,
  getWeekdaySettings,
  setWeekdayClosed
} from "../services/supabaseService";
import { on, EVENTS } from "../services/eventBus";

function ClosedDaysTable({ year, month }) {
  const [closedDays, setClosedDays] = useState([]);
  const [date, setDate] = useState("");

  const [weekdayClosed, setWeekdayClosedState] = useState({
    0: false, 1: false, 2: false, 3: false, 4: false, 5: false, 6: false
  });

  const weekdays = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];

  const range = useMemo(() => {
    const start = new Date(year, month - 1, 1).toISOString().slice(0, 10);
    const end = new Date(year, month, 0).toISOString().slice(0, 10);
    return { start, end };
  }, [year, month]);

  async function reloadClosedDays() {
    const data = await getClosedDaysInRange(range.start, range.end);
    setClosedDays(data);
  }

  async function reloadWeekdays() {
    const settings = await getWeekdaySettings();
    const next = { 0: false, 1: false, 2: false, 3: false, 4: false, 5: false, 6: false };

    settings.forEach((s) => {
      if (typeof s.weekday === "number") next[s.weekday] = Boolean(s.is_closed);
    });

    setWeekdayClosedState(next);
  }

  useEffect(() => {
    reloadClosedDays();
  }, [range.start, range.end]);

  useEffect(() => {
    reloadWeekdays();
  }, []);

  useEffect(() => {
    const unsub = on(EVENTS.DATA_CHANGED, (info) => {
      const t = info?.table;
      if (t === "closed_days") reloadClosedDays();
      if (t === "settings") reloadWeekdays();
    });
    return unsub;
  }, [range.start, range.end]);

  async function handleAdd() {
    if (!date) return;
    await addClosedDay(date);
    setDate("");
    // refresh via eventBus
  }

  async function handleRemove(d) {
    await removeClosedDay(d);
    // refresh via eventBus
  }

  async function toggleWeekday(dayIndex) {
    const nextValue = !weekdayClosed[dayIndex];
    await setWeekdayClosed(dayIndex, nextValue);
    // refresh via eventBus
  }

  return (
    <div style={{ marginTop: "20px" }}>
      <h2>Geschlossene Tage</h2>

      <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "10px" }}>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          style={{ padding: "4px", fontSize: "14px" }}
        />
        <button onClick={handleAdd} style={{ padding: "4px 8px", fontSize: "13px" }}>
          Hinzufügen
        </button>
      </div>

      <table style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr>
            <th style={thStyle}>Datum</th>
            <th style={thStyle}>Aktion</th>
          </tr>
        </thead>

        <tbody>
          {closedDays.length === 0 ? (
            <tr>
              <td style={tdStyle} colSpan={2}>
                Keine geschlossenen Tage in diesem Monat.
              </td>
            </tr>
          ) : (
            closedDays.map((c) => (
              <tr key={c.id}>
                <td style={tdStyle}>{c.date}</td>
                <td style={tdStyle}>
                  <button
                    onClick={() => handleRemove(c.date)}
                    style={{ padding: "3px 6px", fontSize: "12px" }}
                  >
                    Entfernen
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      <div style={{ marginTop: "25px" }}>
        <h3>Automatisch geschlossene Wochentage</h3>

        <div style={weekdayGrid}>
          {weekdays.map((day, i) => (
            <label key={i} style={weekdayItem}>
              <input
                type="checkbox"
                checked={weekdayClosed[i]}
                onChange={() => toggleWeekday(i)}
              />
              {day}
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

const thStyle = {
  border: "1px solid black",
  padding: "6px",
  backgroundColor: "#f0f0f0",
  fontSize: "12px",
  textAlign: "left"
};

const tdStyle = {
  border: "1px solid black",
  padding: "6px",
  fontSize: "13px"
};

const weekdayGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(2, 1fr)",
  gap: "6px",
  marginTop: "10px"
};

const weekdayItem = {
  fontSize: "14px",
  display: "flex",
  gap: "6px",
  alignItems: "center"
};

export default ClosedDaysTable;