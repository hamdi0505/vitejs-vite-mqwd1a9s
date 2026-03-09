import { useMemo, useState } from "react";
import { generateMonthlyPlan } from "../services/plannerService";
import { createSchedule, insertScheduleEntries, getWorkers } from "../services/supabaseService";

function pad2(n) {
  return String(n).padStart(2, "0");
}

function formatMonthYear(year, month) {
  return `${pad2(month)}.${year}`;
}

function PlanGenerator() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [workerNameById, setWorkerNameById] = useState({});

  const entriesByDate = useMemo(() => {
    if (!plan) return {};
    const map = {};
    plan.entries.forEach((e) => {
      if (!map[e.date]) map[e.date] = [];
      map[e.date].push(e);
    });
    return map;
  }, [plan]);

  async function loadWorkerNames() {
    const ws = await getWorkers();
    const map = {};
    ws.forEach((w) => (map[w.id] = w.name));
    setWorkerNameById(map);
  }

  async function handleGenerate() {
    setLoading(true);
    try {
      await loadWorkerNames();
      const result = await generateMonthlyPlan(year, month);
      setPlan(result);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!plan) return;
    setSaving(true);
  
    try {
      const schedule = await createSchedule(month, year);
  
      const payload = plan.entries.map((e) => ({
        schedule_id: schedule.id,
        worker_id: e.worker_id,
        date: e.date,
        hours: e.hours
      }));
  
      await insertScheduleEntries(payload);
  
      alert("Plan gespeichert. Du findest ihn im Archiv.");
    } catch (err) {
      console.error("SAVE ERROR:", err);
  
      // zeigt dir den echten Grund direkt an
      const msg =
        err?.message ||
        err?.error_description ||
        JSON.stringify(err, null, 2) ||
        "Unbekannter Fehler";
      alert("Speichern fehlgeschlagen:\n\n" + msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ marginTop: "20px" }}>
      <h2>Plan erstellen</h2>

      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "flex-end" }}>
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
          <select value={month} onChange={(e) => setMonth(Number(e.target.value))} style={inputStyle}>
            {Array.from({ length: 12 }).map((_, i) => {
              const m = i + 1;
              return (
                <option key={m} value={m}>
                  {pad2(m)}
                </option>
              );
            })}
          </select>
        </label>

        <button onClick={handleGenerate} style={btnStyle} disabled={loading}>
          {loading ? "Generiere..." : "Plan generieren"}
        </button>

        <button onClick={handleSave} style={btnStyle} disabled={!plan || saving}>
          {saving ? "Speichere..." : "Plan speichern"}
        </button>
      </div>

      {plan ? (
        <div style={{ marginTop: "12px" }}>
          <div style={{ fontSize: "13px", marginBottom: "10px" }}>
            Vorschau: {formatMonthYear(plan.year, plan.month)} — Einträge: {plan.entries.length}
          </div>

          <table style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead>
              <tr>
                <th style={thStyle}>Datum</th>
                <th style={thStyle}>Arbeiter / Stunden</th>
              </tr>
            </thead>
            <tbody>
              {Object.keys(entriesByDate).length === 0 ? (
                <tr>
                  <td style={tdStyle} colSpan={2}>Keine Einträge generiert.</td>
                </tr>
              ) : (
                Object.keys(entriesByDate)
                  .sort()
                  .map((date) => (
                    <tr key={date}>
                      <td style={tdStyle}>{date}</td>
                      <td style={tdStyle}>
                        {entriesByDate[date].map((e, idx) => (
                          <div key={idx}>
                            {workerNameById[e.worker_id] || e.worker_id}: {e.hours}
                          </div>
                        ))}
                      </td>
                    </tr>
                  ))
              )}
            </tbody>
          </table>

          <div style={{ marginTop: "12px" }}>
            <h3>Stunden insgesamt (Vorschau)</h3>
            <table style={{ borderCollapse: "collapse", width: "100%" }}>
              <thead>
                <tr>
                  <th style={thStyle}>Mitarbeiter</th>
                  <th style={thStyle}>Ziel</th>
                  <th style={thStyle}>Geplant</th>
                </tr>
              </thead>
              <tbody>
                {plan.summary.map((s) => (
                  <tr key={s.worker_id}>
                    <td style={tdStyle}>{s.name}</td>
                    <td style={tdStyle}>{s.target_hours}</td>
                    <td style={tdStyle}>{s.assigned_hours}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}

const labelStyle = { display: "flex", flexDirection: "column", gap: "4px", fontSize: "13px" };
const inputStyle = { padding: "6px", fontSize: "14px" };
const btnStyle = { padding: "6px 10px", fontSize: "13px" };

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
  fontSize: "13px",
  verticalAlign: "top"
};

export default PlanGenerator;