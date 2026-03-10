import { useEffect, useMemo, useState } from "react";
import {
  getSchedules,
  getScheduleEntriesInRange,
  getWorkers,
  deleteSchedule
} from "../services/supabaseService";
import { on, EVENTS } from "../services/eventBus";
import jsPDF from "jspdf";

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

function isIOS() {
  const ua = navigator.userAgent || "";
  return /iPad|iPhone|iPod/.test(ua);
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);

  // iOS kann Downloads anders behandeln -> öffnen statt "Druckseite"
  if (isIOS()) {
    window.open(url, "_blank");
    return;
  }

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();

  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function newDoc() {
  // A4 portrait, mm
  return new jsPDF({ unit: "mm", format: "a4" });
}

function textWrap(doc, text, x, y, maxWidth, lineHeight) {
  const lines = doc.splitTextToSize(String(text), maxWidth);
  lines.forEach((l, i) => doc.text(l, x, y + i * lineHeight));
  return y + lines.length * lineHeight;
}

// simple table drawer (2 columns)
function drawTableHeader(doc, x, y, w1, w2, h, leftTitle, rightTitle) {
  doc.rect(x, y, w1 + w2, h);
  doc.line(x + w1, y, x + w1, y + h);
  doc.setFont(undefined, "bold");
  doc.text(leftTitle, x + 2, y + 6);
  doc.text(rightTitle, x + w1 + 2, y + 6);
  doc.setFont(undefined, "normal");
  return y + h;
}

function drawRow(doc, x, y, w1, w2, minH, leftText, rightLines) {
  // compute right height
  const rightText = Array.isArray(rightLines) ? rightLines.join("\n") : String(rightLines || "");
  const leftLines = doc.splitTextToSize(String(leftText), w1 - 4);
  const rightSplit = doc.splitTextToSize(rightText, w2 - 4);

  const lineH = 5;
  const h = Math.max(minH, leftLines.length * lineH + 4, rightSplit.length * lineH + 4);

  doc.rect(x, y, w1 + w2, h);
  doc.line(x + w1, y, x + w1, y + h);

  // left
  doc.text(leftLines, x + 2, y + 6);

  // right
  doc.text(rightSplit, x + w1 + 2, y + 6);

  return y + h;
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
    if (!selectedScheduleId || !fromDate || !toDate) return;

    const data = await loadEntriesForCurrentRange();

    // group by date
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

    // totals
    const totals = {};
    data.forEach((e) => {
      totals[e.worker_id] = (totals[e.worker_id] || 0) + Number(e.hours || 0);
    });

    const totalsLines = Object.keys(totals)
      .sort((a, b) => (workerNameById[a] || a).localeCompare(workerNameById[b] || b))
      .map((wid) => `${workerNameById[wid] || wid}: ${totals[wid]} Stunden`);

    const doc = newDoc();
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();

    const margin = 15;

    // Header
    doc.setFont(undefined, "bold");
    doc.setFontSize(34);
    doc.text("Schichtplan", pageW / 2, 22, { align: "center" });

    doc.setFontSize(10);
    doc.setFont(undefined, "normal");
    doc.text(companyName, pageW - margin, 12, { align: "right" });

    // Box (Name + Datum)
    let y = 30;
    const boxX = margin;
    const boxW = pageW - margin * 2;
    const boxH = 18;

    doc.rect(boxX, y, boxW, boxH);
    doc.line(boxX + boxW / 2, y, boxX + boxW / 2, y + boxH);
    doc.line(boxX, y + boxH / 2, boxX + boxW, y + boxH / 2);

    doc.setFont(undefined, "bold");
    doc.setFontSize(12);
    doc.text("Vor- und Nachname", boxX + 2, y + 6);
    doc.text("Datum", boxX + 2, y + boxH / 2 + 6);

    doc.setFont(undefined, "normal");
    doc.text(currentUsername || "Admin", boxX + boxW / 2 + 2, y + 6);

    doc.setFont(undefined, "bold");
    doc.text(`${formatDE(fromDate)} - ${formatDE(toDate)}`, boxX + boxW / 2 + 2, y + boxH / 2 + 6);

    // Table
    y = y + boxH + 10;

    const col1 = 55;
    const col2 = boxW - col1;
    const headerH = 10;
    const rowMinH = 14;

    doc.setFontSize(11);
    y = drawTableHeader(doc, boxX, y, col1, col2, headerH, "Datum", "Arbeiter/Stunden");

    doc.setFontSize(10);
    for (const d of daysWithEntries) {
      if (y + rowMinH > pageH - margin) {
        doc.addPage();
        y = margin;
        doc.setFontSize(11);
        y = drawTableHeader(doc, boxX, y, col1, col2, headerH, "Datum", "Arbeiter/Stunden");
        doc.setFontSize(10);
      }
      y = drawRow(doc, boxX, y, col1, col2, rowMinH, formatDE(d), dayLines[d]);
    }

    // Totals block
    if (y + 40 > pageH - margin) {
      doc.addPage();
      y = margin;
    }
    doc.setFont(undefined, "bold");
    doc.setFontSize(11);
    doc.text("Stunden insgesamt:", boxX + col1 + 2, y + 8);
    doc.setFont(undefined, "normal");
    doc.setFontSize(10);

    let ty = y + 14;
    const maxW = col2 - 4;
    for (const line of totalsLines) {
      if (ty > pageH - margin) {
        doc.addPage();
        ty = margin;
      }
      ty = textWrap(doc, line, boxX + col1 + 2, ty, maxW, 5);
    }

    const blob = doc.output("blob");
    const filename = `Schichtplan_Admin_${fromDate}_${toDate}.pdf`;
    downloadBlob(blob, filename);
  }

  async function handlePdfWorker() {
    if (!selectedScheduleId || !fromDate || !toDate) return;

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

    const workerName = workerNameById[workerId] || currentUsername || "Mitarbeiter";

    const doc = newDoc();
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 15;

    // Header
    doc.setFont(undefined, "bold");
    doc.setFontSize(34);
    doc.text("Schichtplan", pageW / 2, 22, { align: "center" });

    doc.setFontSize(10);
    doc.setFont(undefined, "normal");
    doc.text(companyName, pageW - margin, 12, { align: "right" });

    // Box (Name + Datum + Summe)
    let y = 30;
    const boxX = margin;
    const boxW = pageW - margin * 2;
    const boxH = 27;

    doc.rect(boxX, y, boxW, boxH);
    doc.line(boxX + boxW / 2, y, boxX + boxW / 2, y + boxH);
    doc.line(boxX, y + boxH / 3, boxX + boxW, y + boxH / 3);
    doc.line(boxX, y + (2 * boxH) / 3, boxX + boxW, y + (2 * boxH) / 3);

    doc.setFont(undefined, "bold");
    doc.setFontSize(12);
    doc.text("Vor- und Nachname", boxX + 2, y + 6);
    doc.text("Datum", boxX + 2, y + boxH / 3 + 6);
    doc.text("Stunden insgesamt", boxX + 2, y + (2 * boxH) / 3 + 6);

    doc.setFont(undefined, "normal");
    doc.text(workerName, boxX + boxW / 2 + 2, y + 6);

    doc.setFont(undefined, "bold");
    doc.text(`${formatDE(fromDate)} - ${formatDE(toDate)}`, boxX + boxW / 2 + 2, y + boxH / 3 + 6);

    doc.setFont(undefined, "normal");
    doc.text(String(total), boxX + boxW / 2 + 2, y + (2 * boxH) / 3 + 6);

    // Table
    y = y + boxH + 10;
    const col1 = 80;
    const col2 = boxW - col1;
    const headerH = 10;
    const rowMinH = 12;

    doc.setFontSize(11);
    y = drawTableHeader(doc, boxX, y, col1, col2, headerH, "Datum", "Stunden");

    doc.setFontSize(10);
    for (const d of daysWithHours) {
      if (y + rowMinH > pageH - margin) {
        doc.addPage();
        y = margin;
        doc.setFontSize(11);
        y = drawTableHeader(doc, boxX, y, col1, col2, headerH, "Datum", "Stunden");
        doc.setFontSize(10);
      }
      y = drawRow(doc, boxX, y, col1, col2, rowMinH, formatDE(d), [`${workerHoursByDay[d]}`]);
    }

    const blob = doc.output("blob");
    const filename = `Schichtplan_${workerName}_${fromDate}_${toDate}.pdf`;
    downloadBlob(blob, filename);
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