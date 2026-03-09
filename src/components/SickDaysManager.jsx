import { useEffect, useMemo, useState } from "react";
import {
  addSickDay,
  getSickDaysInRange,
  removeSickDay,
  getWorkers
} from "../services/supabaseService";
import { on, EVENTS } from "../services/eventBus";

function SickDaysManager({ year, month, workerId }) {
  const isWorkerMode = Boolean(workerId);

  const [workers, setWorkers] = useState([]);
  const [selectedWorkerId, setSelectedWorkerId] = useState("");
  const [viewWorkerId, setViewWorkerId] = useState("ALL");

  const [date, setDate] = useState("");
  const [sickDays, setSickDays] = useState([]);

  const workerNameById = useMemo(() => {
    const map = {};
    workers.forEach((w) => (map[w.id] = w.name));
    return map;
  }, [workers]);

  const range = useMemo(() => {
    const start = new Date(year, month - 1, 1).toISOString().slice(0, 10);
    const end = new Date(year, month, 0).toISOString().slice(0, 10);
    return { start, end };
  }, [year, month]);

  async function reloadWorkers() {
    if (isWorkerMode) return;
    const data = await getWorkers();
    setWorkers(data);
    if (data.length > 0 && !selectedWorkerId) setSelectedWorkerId(data[0].id);
  }

  async function reloadSickDays() {
    const data = await getSickDaysInRange(range.start, range.end);
    setSickDays(data);
  }

  useEffect(() => {
    reloadWorkers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    reloadSickDays();
  }, [range.start, range.end]);

  useEffect(() => {
    const unsub = on(EVENTS.DATA_CHANGED, (info) => {
      const t = info?.table;
      if (t === "sick_days") reloadSickDays();
      if (!isWorkerMode && t === "workers") reloadWorkers();
    });

    return unsub;
  }, [range.start, range.end, isWorkerMode, selectedWorkerId]);

  const filtered = useMemo(() => {
    if (isWorkerMode) return sickDays.filter((s) => s.worker_id === workerId);
    if (viewWorkerId === "ALL") return sickDays;
    return sickDays.filter((s) => s.worker_id === viewWorkerId);
  }, [sickDays, viewWorkerId, isWorkerMode, workerId]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    copy.sort((a, b) => {
      if (a.date < b.date) return -1;
      if (a.date > b.date) return 1;

      if (!isWorkerMode) {
        const an = workerNameById[a.worker_id] || "";
        const bn = workerNameById[b.worker_id] || "";
        return an.localeCompare(bn);
      }
      return 0;
    });
    return copy;
  }, [filtered, workerNameById, isWorkerMode]);

  async function handleAdd() {
    const targetWorkerId = isWorkerMode ? workerId : selectedWorkerId;
    if (!targetWorkerId || !date) return;

    await addSickDay(targetWorkerId, date);
    setDate("");
    // refresh via eventBus
  }

  async function handleRemove(targetWorkerId, d) {
    await removeSickDay(targetWorkerId, d);
    // refresh via eventBus
  }

  return (
    <div style={{ marginTop: "20px" }}>
      <h2>Kranktage</h2>

      <div style={{ display: "flex", gap: "8px", alignItems: "flex-end", marginBottom: "10px", flexWrap: "wrap" }}>
        {!isWorkerMode ? (
          <label style={labelStyle}>
            Mitarbeiter (Eintragen)
            <select
              value={selectedWorkerId}
              onChange={(e) => setSelectedWorkerId(e.target.value)}
              style={inputStyle}
            >
              {workers.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <label style={labelStyle}>
          Datum
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            style={inputStyle}
          />
        </label>

        <button onClick={handleAdd} style={{ padding: "4px 8px", fontSize: "13px" }}>
          Hinzufügen
        </button>

        {!isWorkerMode ? (
          <label style={labelStyle}>
            Anzeige
            <select
              value={viewWorkerId}
              onChange={(e) => setViewWorkerId(e.target.value)}
              style={inputStyle}
            >
              <option value="ALL">Alle Mitarbeiter</option>
              {workers.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      <table style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr>
            <th style={thStyle}>Datum</th>
            {!isWorkerMode ? <th style={thStyle}>Mitarbeiter</th> : null}
            <th style={thStyle}>Aktion</th>
          </tr>
        </thead>

        <tbody>
          {sorted.length === 0 ? (
            <tr>
              <td style={tdStyle} colSpan={isWorkerMode ? 2 : 3}>
                Keine Kranktage in diesem Monat.
              </td>
            </tr>
          ) : (
            sorted.map((s) => (
              <tr key={s.id}>
                <td style={tdStyle}>{s.date}</td>

                {!isWorkerMode ? (
                  <td style={tdStyle}>{workerNameById[s.worker_id] || s.worker_id}</td>
                ) : null}

                <td style={tdStyle}>
                  <button
                    onClick={() => handleRemove(isWorkerMode ? workerId : s.worker_id, s.date)}
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
    </div>
  );
}

const labelStyle = { display: "flex", flexDirection: "column", fontSize: "13px", gap: "4px" };
const inputStyle = { padding: "4px", fontSize: "14px" };

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

export default SickDaysManager;