import { useEffect, useState } from "react";
import { getWeekdaySettings, setWeekdayMaxWorkers } from "../services/supabaseService";
import { on, EVENTS } from "../services/eventBus";

const WEEKDAYS = [
  { label: "Sonntag", value: 0 },
  { label: "Montag", value: 1 },
  { label: "Dienstag", value: 2 },
  { label: "Mittwoch", value: 3 },
  { label: "Donnerstag", value: 4 },
  { label: "Freitag", value: 5 },
  { label: "Samstag", value: 6 }
];

function WeekdaySettings() {
  const [maxWorkers, setMaxWorkersState] = useState({
    0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0
  });

  async function reload() {
    const settings = await getWeekdaySettings();
    const next = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };

    settings.forEach((s) => {
      if (typeof s.weekday === "number") {
        next[s.weekday] = Number(s.max_workers || 0);
      }
    });

    setMaxWorkersState(next);
  }

  useEffect(() => {
    reload();
  }, []);

  useEffect(() => {
    const unsub = on(EVENTS.DATA_CHANGED, (info) => {
      if (info?.table === "settings") reload();
    });
    return unsub;
  }, []);

  async function handleChange(weekday, value) {
    const num = Number(value);

    setMaxWorkersState((prev) => ({
      ...prev,
      [weekday]: num
    }));

    await setWeekdayMaxWorkers(weekday, num);
    // refresh via eventBus
  }

  return (
    <div style={{ marginTop: "25px" }}>
      <h2>Wochentag-Limits</h2>

      <div style={{ fontSize: "12px", opacity: 0.8, marginBottom: "10px" }}>
        Hier stellst du ein, wie viele Mitarbeiter maximal pro Wochentag eingeplant werden dürfen.
      </div>

      <table style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr>
            <th style={thStyle}>Wochentag</th>
            <th style={thStyle}>Max. Mitarbeiter</th>
          </tr>
        </thead>

        <tbody>
          {WEEKDAYS.map((d) => (
            <tr key={d.value}>
              <td style={tdStyle}>{d.label}</td>
              <td style={tdStyle}>
                <input
                  type="number"
                  min="0"
                  value={maxWorkers[d.value]}
                  onChange={(e) => handleChange(d.value, e.target.value)}
                  style={{ width: "80px", padding: "4px", fontSize: "14px" }}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
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

export default WeekdaySettings;