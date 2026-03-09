import { useEffect, useState } from "react";
import { getOpeningHours, upsertOpeningHour } from "../services/supabaseService";

const WEEKDAYS = [
  { label: "Sonntag", value: 0 },
  { label: "Montag", value: 1 },
  { label: "Dienstag", value: 2 },
  { label: "Mittwoch", value: 3 },
  { label: "Donnerstag", value: 4 },
  { label: "Freitag", value: 5 },
  { label: "Samstag", value: 6 }
];

function toHHMM(value) {
  if (!value) return "09:00";
  return value.slice(0, 5);
}

function splitHHMM(hhmm) {
  const [hh, mm] = (hhmm || "00:00").split(":");
  return { hh: hh || "00", mm: mm || "00" };
}

function clamp2Digits(v, max) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "00";
  const clamped = Math.max(0, Math.min(max, n));
  return String(clamped).padStart(2, "0");
}

function OpeningHoursSettings() {
  const [rows, setRows] = useState(
    WEEKDAYS.reduce((acc, d) => {
      acc[d.value] = { open_time: "09:00", close_time: "17:00" };
      return acc;
    }, {})
  );

  const [savingDay, setSavingDay] = useState(null);

  useEffect(() => {
    async function load() {
      const data = await getOpeningHours();

      const next = { ...rows };
      data.forEach((r) => {
        next[r.weekday] = {
          open_time: toHHMM(r.open_time),
          close_time: toHHMM(r.close_time)
        };
      });

      setRows(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    load();
  }, []);

  function setTimePart(weekday, field, part, value) {
    setRows((prev) => {
      const current = prev[weekday][field];
      const { hh, mm } = splitHHMM(current);

      const nextHH = part === "hh" ? clamp2Digits(value, 23) : hh;
      const nextMM = part === "mm" ? clamp2Digits(value, 59) : mm;

      return {
        ...prev,
        [weekday]: {
          ...prev[weekday],
          [field]: `${nextHH}:${nextMM}`
        }
      };
    });
  }

  async function save(weekday) {
    const r = rows[weekday];
    setSavingDay(weekday);

    try {
      // "geschlossen" kommt aus settings.is_closed, daher immer false hier
      await upsertOpeningHour(weekday, false, r.open_time, r.close_time);
    } finally {
      setSavingDay(null);
    }
  }

  return (
    <div style={{ marginTop: "20px" }}>
      <h2>Öffnungszeiten</h2>

      
      

      <table style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr>
            <th style={thStyle}>Wochentag</th>
            <th style={thStyle}>Von</th>
            <th style={thStyle}>Bis</th>
            <th style={thStyle}>Aktion</th>
          </tr>
        </thead>
        <tbody>
          {WEEKDAYS.map((d) => {
            const r = rows[d.value];
            const o = splitHHMM(r.open_time);
            const c = splitHHMM(r.close_time);

            return (
              <tr key={d.value}>
                <td style={tdStyle}>{d.label}</td>

                <td style={tdStyle}>
                  <div style={timeWrapStyle}>
                    <input
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={o.hh}
                      onChange={(e) => setTimePart(d.value, "open_time", "hh", e.target.value)}
                      style={timeInputStyle}
                    />
                    <span style={colonStyle}>:</span>
                    <input
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={o.mm}
                      onChange={(e) => setTimePart(d.value, "open_time", "mm", e.target.value)}
                      style={timeInputStyle}
                    />
                  </div>
                </td>

                <td style={tdStyle}>
                  <div style={timeWrapStyle}>
                    <input
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={c.hh}
                      onChange={(e) => setTimePart(d.value, "close_time", "hh", e.target.value)}
                      style={timeInputStyle}
                    />
                    <span style={colonStyle}>:</span>
                    <input
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={c.mm}
                      onChange={(e) => setTimePart(d.value, "close_time", "mm", e.target.value)}
                      style={timeInputStyle}
                    />
                  </div>
                </td>

                <td style={tdStyle}>
                  <button
                    onClick={() => save(d.value)}
                    style={btnStyle}
                    disabled={savingDay === d.value}
                  >
                    {savingDay === d.value ? "..." : "Speichern"}
                  </button>
                </td>
              </tr>
            );
          })}
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
  textAlign: "left",
  whiteSpace: "nowrap"
};

const tdStyle = {
  border: "1px solid black",
  padding: "6px",
  fontSize: "13px",
  verticalAlign: "top"
};

const timeWrapStyle = {
  display: "flex",
  alignItems: "center",
  gap: "2px"
};

const timeInputStyle = {
  width: "32px",
  padding: "2px 4px",
  fontSize: "13px",
  textAlign: "center"
};

const colonStyle = {
  fontSize: "13px",
  lineHeight: "1"
};

const btnStyle = {
  fontSize: "12px",
  padding: "4px 6px",
  whiteSpace: "nowrap"
};

export default OpeningHoursSettings;