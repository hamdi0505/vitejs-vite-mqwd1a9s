import { useEffect, useMemo, useState } from "react";
import {
  getSchedules,
  getScheduleEntriesInRange,
  getWorkers,
  deleteSchedule
} from "../services/supabaseService";
import { on, EVENTS } from "../services/eventBus";

function pad2(n) {
  return String(n).padStart(2, "0");
}

function monthStart(year, month) {
  return `${year}-${pad2(month)}-01`;
}

function monthEnd(year, month) {
  const d = new Date(year, month, 0);
  return `${year}-${pad2(month)}-${pad2(d.getDate())}`;
}

function formatScheduleLabel(s) {
  return `${pad2(s.month)}.${s.year}`;
}

function parseYmd(ymd) {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function toYmd(dateObj) {
  const y = dateObj.getFullYear();
  const m = pad2(dateObj.getMonth() + 1);
  const d = pad2(dateObj.getDate());
  return `${y}-${m}-${d}`;
}

function getDateRangeList(startYmd, endYmd) {
  const start = parseYmd(startYmd);
  const end = parseYmd(endYmd);
  const out = [];
  const cur = new Date(start);

  while (cur <= end) {
    out.push(toYmd(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

function formatDE(ymd) {
  const [y, m, d] = ymd.split("-");
  return `${d}.${m}.${y}`;
}

function openPrintWindow(html) {
  const w = window.open("", "_blank");
  if (!w) {
    alert("Popup wurde blockiert. Bitte Popups erlauben.");
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();

  w.onload = () => {
    try {
      w.focus();
      w.print();
    } catch {
      // ignore
    }
  };
}

function buildAdminHtml({ companyName, adminName, rangeText, days, dayLines, totalsLines }) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Schichtplan</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 24px; color: #000; }
    .topRight { position: absolute; top: 18px; right: 24px; font-size: 16px; }
    h1 { text-align: center; font-size: 56px; margin: 0 0 18px 0; text-decoration: underline; }

    .box { border: 1px solid #000; margin-bottom: 14px; }
    .row { display: grid; grid-template-columns: 1.2fr 1fr; border-top: 1px solid #000; }
    .row:first-child { border-top: none; }
    .cell { padding: 10px; border-right: 1px solid #000; }
    .row .cell:last-child { border-right: none; }
    .bold { font-weight: 700; }

    .table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    .table th, .table td { border: 1px solid #000; padding: 10px; vertical-align: top; }
    .table th { background: #f0f0f0; text-align: left; font-weight: 700; }

    .lines div { margin-bottom: 4px; }

    .footerBox { border: 1px solid #000; }
    .footerTitle { font-weight: 700; margin-bottom: 6px; }
  </style>
</head>
<body>
  <div class="topRight">${companyName}</div>
  <h1>Schichtplan</h1>

  <div class="box">
    <div class="row">
      <div class="cell bold">Vor- und Nachname</div>
      <div class="cell">${adminName}</div>
    </div>
    <div class="row">
      <div class="cell bold">Datum</div>
      <div class="cell bold">${rangeText}</div>
    </div>
  </div>

  <table class="table">
    <thead>
      <tr>
        <th style="width: 30%;">Datum</th>
        <th>Arbeiter/Stunden</th>
      </tr>
    </thead>
    <tbody>
      ${days
        .map((d) => {
          const lines = dayLines[d] || [];
          return `
            <tr>
              <td>${formatDE(d)}</td>
              <td class="lines">
                ${lines.map((x) => `<div>${x}</div>`).join("")}
              </td>
            </tr>
          `;
        })
        .join("")}
      <tr>
        <td></td>
        <td class="footerBox">
          <div class="footerTitle">Stunden insgesamt:</div>
          ${totalsLines.map((l) => `<div>${l}</div>`).join("")}
        </td>
      </tr>
    </tbody>
  </table>
</body>
</html>
`;
}

function buildWorkerHtml({ companyName, workerName, rangeText, days, workerHoursByDay, totalHours }) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Schichtplan</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 24px; color: #000; }
    .topRight { position: absolute; top: 18px; right: 24px; font-size: 16px; }
    h1 { text-align: center; font-size: 56px; margin: 0 0 18px 0; text-decoration: underline; }

    .box { border: 1px solid #000; margin-bottom: 14px; }
    .row { display: grid; grid-template-columns: 1.2fr 1fr; border-top: 1px solid #000; }
    .row:first-child { border-top: none; }
    .cell { padding: 10px; border-right: 1px solid #000; }
    .row .cell:last-child { border-right: none; }
    .bold { font-weight: 700; }

    .table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    .table th, .table td { border: 1px solid #000; padding: 10px; vertical-align: top; }
    .table th { background: #f0f0f0; text-align: left; font-weight: 700; }
  </style>
</head>
<body>
  <div class="topRight">${companyName}</div>
  <h1>Schichtplan</h1>

  <div class="box">
    <div class="row">
      <div class="cell bold">Vor- und Nachname</div>
      <div class="cell">${workerName}</div>
    </div>
    <div class="row">
      <div class="cell bold">Datum</div>
      <div class="cell bold">${rangeText}</div>
    </div>
    <div class="row">
      <div class="cell bold">Stunden insgesamt</div>
      <div class="cell">${totalHours}</div>
    </div>
  </div>

  <table class="table">
    <thead>
      <tr>
        <th style="width: 50%;">Datum</th>
        <th>Stunden</th>
      </tr>
    </thead>
    <tbody>
      ${days
        .map((d) => {
          const h = workerHoursByDay[d] ?? 0;
          return `
            <tr>
              <td>${formatDE(d)}</td>
              <td>${h}</td>
            </tr>
          `;
        })
        .join("")}
    </tbody>
  </table>
</body>
</html>
`;
}

function ScheduleArchive({ mode, workerId, currentUsername, companyName = "Bone'Ma Löbau" }) {
  const [schedules, setSchedules] = useState([]);
  const [selectedScheduleId, setSelectedScheduleId] = useState("");

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);

  const [workerNameById, setWorkerNameById] = useState({});

  const selectedSchedule = useMemo(() => {
    return schedules.find((s) => s.id === selectedScheduleId) || null;
  }, [schedules, selectedScheduleId]);

  async function loadSchedules() {
    const data = await getSchedules();
    setSchedules(data);

    if (data.length > 0) {
      const exists = data.some((s) => s.id === selectedScheduleId);
      if (!exists) setSelectedScheduleId(data[0].id);
    } else {
      setSelectedScheduleId("");
    }
  }

  async function loadWorkers() {
    const ws = await getWorkers();
    const map = {};
    ws.forEach((w) => (map[w.id] = w.name));
    setWorkerNameById(map);
  }

  useEffect(() => {
    loadSchedules();
    loadWorkers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedSchedule) return;

    const start = monthStart(selectedSchedule.year, selectedSchedule.month);
    const end = monthEnd(selectedSchedule.year, selectedSchedule.month);

    setFromDate(start);
    setToDate(end);
  }, [selectedSchedule?.id]);

  useEffect(() => {
    const unsub = on(EVENTS.DATA_CHANGED, (info) => {
      if (info?.table === "schedules" || info?.table === "schedule_entries") {
        loadSchedules();
      }
    });
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedScheduleId]);

  async function loadEntriesForCurrentRange() {
    if (!selectedScheduleId || !fromDate || !toDate) return [];

    const data = await getScheduleEntriesInRange(selectedScheduleId, fromDate, toDate);
    const filtered =
      mode === "worker" && workerId
        ? data.filter((e) => e.worker_id === workerId)
        : data;

    return filtered;
  }

  async function handleShow() {
    if (!selectedScheduleId || !fromDate || !toDate) return;

    setLoading(true);
    try {
      const filtered = await loadEntriesForCurrentRange();
      setEntries(filtered);
    } finally {
      setLoading(false);
    }
  }

  async function handleDeletePlan() {
    if (!selectedScheduleId) return;

    const ok = window.confirm("Möchtest du diesen gespeicherten Plan wirklich löschen?");
    if (!ok) return;

    await deleteSchedule(selectedScheduleId);

    setEntries([]);
    await loadSchedules();

    alert("Plan gelöscht.");
  }

  const entriesByDate = useMemo(() => {
    const map = {};
    entries.forEach((e) => {
      if (!map[e.date]) map[e.date] = [];
      map[e.date].push(e);
    });
    return map;
  }, [entries]);

  const allDatesInRange = useMemo(() => {
    if (!fromDate || !toDate) return [];
    return getDateRangeList(fromDate, toDate);
  }, [fromDate, toDate]);

  const dayLinesForDisplay = useMemo(() => {
    const out = {};
    allDatesInRange.forEach((d) => {
      const dayEntries = entriesByDate[d] || [];
      out[d] = dayEntries.map((e) => {
        const name = workerNameById[e.worker_id] || e.worker_id;
        return `${name}: ${e.hours}`;
      });
    });
    return out;
  }, [allDatesInRange, entriesByDate, workerNameById]);

  async function handlePdfAdmin() {
    const data = await loadEntriesForCurrentRange();

    const allDays = getDateRangeList(fromDate, toDate);
    const byDate = {};
    data.forEach((e) => {
      if (!byDate[e.date]) byDate[e.date] = [];
      byDate[e.date].push(e);
    });

    const dayLines = {};
    allDays.forEach((d) => {
      const dayEntries = byDate[d] || [];
      dayLines[d] = dayEntries.map((e) => {
        const name = workerNameById[e.worker_id] || e.worker_id;
        return `${name}: ${e.hours}`;
      });
    });

    const daysWithEntries = allDays.filter((d) => (dayLines[d] || []).length > 0);
    const rangeText = `${formatDE(fromDate)} - ${formatDE(toDate)}`;

    const totals = {};
    data.forEach((e) => {
      totals[e.worker_id] = (totals[e.worker_id] || 0) + Number(e.hours || 0);
    });

    const totalsLines = Object.keys(totals)
      .sort((a, b) => (workerNameById[a] || a).localeCompare(workerNameById[b] || b))
      .map((wid) => `${workerNameById[wid] || wid}: ${totals[wid]} Stunden`);

    const html = buildAdminHtml({
      companyName,
      adminName: currentUsername || "Admin",
      rangeText,
      days: daysWithEntries,
      dayLines,
      totalsLines
    });

    openPrintWindow(html);
  }

  async function handlePdfWorker() {
    const data = await loadEntriesForCurrentRange();

    const allDays = getDateRangeList(fromDate, toDate);
    const byDate = {};
    data.forEach((e) => {
      if (!byDate[e.date]) byDate[e.date] = [];
      byDate[e.date].push(e);
    });

    const workerHoursByDay = {};
    let total = 0;

    allDays.forEach((d) => {
      const dayEntries = byDate[d] || [];
      const sum = dayEntries.reduce((acc, e) => acc + Number(e.hours || 0), 0);
      workerHoursByDay[d] = sum;
      total += sum;
    });

    const daysWithHours = allDays.filter((d) => (workerHoursByDay[d] || 0) > 0);
    const rangeText = `${formatDE(fromDate)} - ${formatDE(toDate)}`;
    const workerName = workerNameById[workerId] || currentUsername || "Mitarbeiter";

    const html = buildWorkerHtml({
      companyName,
      workerName,
      rangeText,
      days: daysWithHours,
      workerHoursByDay,
      totalHours: total
    });

    openPrintWindow(html);
  }

  const pdfEnabled = Boolean(selectedScheduleId && fromDate && toDate);

  return (
    <div style={{ marginTop: "20px" }}>
      <h2>Pläne (Archiv)</h2>

      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "flex-end" }}>
        <label style={labelStyle}>
          Gespeicherter Plan
          <select
            value={selectedScheduleId}
            onChange={(e) => setSelectedScheduleId(e.target.value)}
            style={inputStyle}
          >
            {schedules.length === 0 ? (
              <option value="">Keine Pläne vorhanden</option>
            ) : (
              schedules.map((s) => (
                <option key={s.id} value={s.id}>
                  {formatScheduleLabel(s)}
                </option>
              ))
            )}
          </select>
        </label>

        <label style={labelStyle}>
          Von
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} style={inputStyle} />
        </label>

        <label style={labelStyle}>
          Bis
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} style={inputStyle} />
        </label>

        <button onClick={handleShow} style={btnStyle} disabled={loading || schedules.length === 0}>
          {loading ? "Lade..." : "Anzeigen"}
        </button>

        {mode === "admin" ? (
          <>
            <button onClick={handlePdfAdmin} style={btnStyle} disabled={!pdfEnabled}>
              PDF (Admin)
            </button>

            <button onClick={handleDeletePlan} style={dangerBtnStyle} disabled={!selectedScheduleId}>
              Plan löschen
            </button>
          </>
        ) : (
          <button onClick={handlePdfWorker} style={btnStyle} disabled={!pdfEnabled}>
            PDF (Mitarbeiter)
          </button>
        )}
      </div>

      <div style={{ marginTop: "12px" }}>
        <table style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr>
              <th style={thStyle}>Datum</th>
              <th style={thStyle}>Arbeiter / Stunden</th>
            </tr>
          </thead>
          <tbody>
            {allDatesInRange.length === 0 ? (
              <tr>
                <td style={tdStyle} colSpan={2}>
                  Bitte Plan wählen und Von/Bis setzen.
                </td>
              </tr>
            ) : (
              allDatesInRange.map((date) => {
                const lines = dayLinesForDisplay[date] || [];
                return (
                  <tr key={date}>
                    <td style={tdStyle}>{date}</td>
                    <td style={tdStyle}>
                      {lines.length === 0 ? "-" : lines.map((l, i) => <div key={i}>{l}</div>)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const labelStyle = { display: "flex", flexDirection: "column", gap: "4px", fontSize: "13px" };
const inputStyle = { padding: "6px", fontSize: "14px" };
const btnStyle = { padding: "6px 10px", fontSize: "13px", whiteSpace: "nowrap" };

const dangerBtnStyle = { ...btnStyle, border: "1px solid black" };

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

export default ScheduleArchive;