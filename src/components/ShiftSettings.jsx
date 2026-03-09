import { useEffect, useMemo, useState } from "react";
import { getWeekdayShifts, saveWeekdayShifts } from "../services/supabaseService";

const WEEKDAYS = [
  { label: "Montag", value: 1 },
  { label: "Dienstag", value: 2 },
  { label: "Mittwoch", value: 3 },
  { label: "Donnerstag", value: 4 },
  { label: "Freitag", value: 5 },
  { label: "Samstag", value: 6 },
  { label: "Sonntag", value: 0 }
];

function pad2(n) {
  return String(n).padStart(2, "0");
}
function toHHMM(v) {
  if (!v) return "10:00";
  return String(v).slice(0, 5);
}
function splitHHMM(hhmm) {
  const [hh, mm] = (hhmm || "00:00").split(":");
  return { hh: hh || "00", mm: mm || "00" };
}
function clamp2(v, max) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "00";
  return pad2(Math.max(0, Math.min(max, n)));
}

function ShiftSettings() {
  const [weekday, setWeekday] = useState(1);
  const [shiftCount, setShiftCount] = useState(1);

  // shifts state: index 1..6
  const [shifts, setShifts] = useState({
    1: { start: "10:00", end: "16:00", workers: 2 },
    2: { start: "16:00", end: "20:00", workers: 2 },
    3: { start: "20:00", end: "00:00", workers: 3 },
    4: { start: "10:00", end: "16:00", workers: 0 },
    5: { start: "10:00", end: "16:00", workers: 0 },
    6: { start: "10:00", end: "16:00", workers: 0 }
  });

  const visibleIndices = useMemo(() => {
    return Array.from({ length: shiftCount }).map((_, i) => i + 1);
  }, [shiftCount]);

  useEffect(() => {
    async function load() {
      const rows = await getWeekdayShifts(weekday);

      if (!rows || rows.length === 0) {
        // keine gespeicherten Schichten => UI bleibt bei Default
        return;
      }

      const next = { ...shifts };

      rows.forEach((r) => {
        next[r.shift_index] = {
          start: toHHMM(r.start_time),
          end: toHHMM(r.end_time),
          workers: Number(r.workers_needed || 0)
        };
      });

      // shiftCount automatisch an gespeicherte Anzahl anpassen
      const maxIdx = Math.max(...rows.map((r) => r.shift_index));
      setShiftCount(Math.max(1, Math.min(6, maxIdx)));

      setShifts(next);
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekday]);

  function setTimePart(idx, field, part, value) {
    setShifts((prev) => {
      const current = prev[idx][field];
      const { hh, mm } = splitHHMM(current);

      const nextHH = part === "hh" ? clamp2(value, 23) : hh;
      const nextMM = part === "mm" ? clamp2(value, 59) : mm;

      return {
        ...prev,
        [idx]: { ...prev[idx], [field]: `${nextHH}:${nextMM}` }
      };
    });
  }

  function setWorkers(idx, value) {
    setShifts((prev) => ({
      ...prev,
      [idx]: { ...prev[idx], workers: Number(value) }
    }));
  }

  async function handleSave() {
    const payload = visibleIndices.map((idx) => ({
      shift_index: idx,
      start_time: shifts[idx].start,
      end_time: shifts[idx].end,
      workers_needed: Number(shifts[idx].workers || 0)
    }));

    await saveWeekdayShifts(weekday, payload);
    alert("Schichten gespeichert.");
  }

  return (
    <div style={{ marginTop: "20px" }}>
      <h2>Schichten pro Wochentag</h2>

      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "flex-end" }}>
        <label style={labelStyle}>
          Wochentag
          <select value={weekday} onChange={(e) => setWeekday(Number(e.target.value))} style={inputStyle}>
            {WEEKDAYS.map((d) => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
        </label>

        <label style={labelStyle}>
          Schichten
          <select value={shiftCount} onChange={(e) => setShiftCount(Number(e.target.value))} style={inputStyle}>
            {[1,2,3,4,5,6].map((n) => (
              <option key={n} value={n}>{n} Schichten</option>
            ))}
          </select>
        </label>

        <button onClick={handleSave} style={btnStyle}>Speichern</button>
      </div>

      <table style={{ borderCollapse: "collapse", width: "100%", marginTop: "12px" }}>
        <thead>
          <tr>
            <th style={thStyle}>Schichten</th>
            <th style={thStyle}>Von</th>
            <th style={thStyle}>Bis</th>
            <th style={thStyle}>Arbeiter</th>
          </tr>
        </thead>
        <tbody>
          {visibleIndices.map((idx) => {
            const s = shifts[idx];
            const st = splitHHMM(s.start);
            const en = splitHHMM(s.end);

            return (
              <tr key={idx}>
                <td style={tdStyle}>Schicht {idx}</td>

                <td style={tdStyle}>
                  <div style={timeWrapStyle}>
                    <input
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={st.hh}
                      onChange={(e) => setTimePart(idx, "start", "hh", e.target.value)}
                      style={timeInputStyle}
                    />
                    <span>:</span>
                    <input
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={st.mm}
                      onChange={(e) => setTimePart(idx, "start", "mm", e.target.value)}
                      style={timeInputStyle}
                    />
                  </div>
                </td>

                <td style={tdStyle}>
                  <div style={timeWrapStyle}>
                    <input
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={en.hh}
                      onChange={(e) => setTimePart(idx, "end", "hh", e.target.value)}
                      style={timeInputStyle}
                    />
                    <span>:</span>
                    <input
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={en.mm}
                      onChange={(e) => setTimePart(idx, "end", "mm", e.target.value)}
                      style={timeInputStyle}
                    />
                  </div>
                </td>

                <td style={tdStyle}>
                  <input
                    type="number"
                    min="0"
                    value={s.workers}
                    onChange={(e) => setWorkers(idx, e.target.value)}
                    style={{ width: "70px", padding: "4px", fontSize: "14px" }}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const labelStyle = { display: "flex", flexDirection: "column", gap: "4px", fontSize: "13px" };
const inputStyle = { padding: "6px", fontSize: "14px" };
const btnStyle = { padding: "6px 10px", fontSize: "13px" };

const thStyle = { border: "1px solid black", padding: "6px", backgroundColor: "#f0f0f0", fontSize: "12px", textAlign: "left" };
const tdStyle = { border: "1px solid black", padding: "6px", fontSize: "13px", verticalAlign: "top" };

const timeWrapStyle = { display: "flex", alignItems: "center", gap: "2px" };
const timeInputStyle = { width: "32px", padding: "2px 4px", fontSize: "13px", textAlign: "center" };

export default ShiftSettings;