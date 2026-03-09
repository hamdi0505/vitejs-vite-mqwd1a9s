import {
  getWorkers,
  getWeekdaySettings,
  getClosedDaysInRange,
  getSickDaysInRange,
  getWorkerAccounts,
  getOpeningHours,
  getWeekdayShifts
} from "./supabaseService";

function pad2(n) { return String(n).padStart(2, "0"); }
function ymdFromParts(y, m, d) { return `${y}-${pad2(m)}-${pad2(d)}`; }
function daysInMonth(year, month) { return new Date(year, month, 0).getDate(); }
function weekdayOfDate(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).getDay(); // 0=So..6=Sa
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function toMinutes(t) {
  const parts = String(t).split(":");
  const hh = Number(parts[0] || 0);
  const mm = Number(parts[1] || 0);
  return hh * 60 + mm;
}

// Fix Ursache B: 00:00 als Mitternacht (24:00), wenn close <= open
function minutesBetween(openTime, closeTime) {
  const o = toMinutes(openTime);
  const c = toMinutes(closeTime);
  const closeFixed = c <= o ? 24 * 60 : c;
  const diff = closeFixed - o;
  return diff > 0 ? diff : 0;
}

export async function generateMonthlyPlan(year, month) {
  const startDate = ymdFromParts(year, month, 1);
  const endDate = ymdFromParts(year, month, daysInMonth(year, month));

  const [workersRaw, settings, closedDays, sickDays, accounts, openingHours] =
    await Promise.all([
      getWorkers(),
      getWeekdaySettings(),
      getClosedDaysInRange(startDate, endDate),
      getSickDaysInRange(startDate, endDate),
      getWorkerAccounts(),
      getOpeningHours()
    ]);

  // Account active map
  const activeAccountByWorkerId = {};
  (accounts || []).forEach((a) => {
    activeAccountByWorkerId[a.worker_id] = a.is_active !== false;
  });

  // Kandidaten: monthly_hours>0 und max_hours_per_day>0 und account aktiv
  const workers = (workersRaw || []).filter((w) => {
    const accountActive = activeAccountByWorkerId[w.id] !== false;
    return accountActive && Number(w.monthly_hours) > 0 && Number(w.max_hours_per_day) > 0;
  });

  // settings: nur CLOSED Tage pro Wochentag (max_workers wird NICHT mehr genutzt)
  const weekdayIsClosed = { 0:false,1:false,2:false,3:false,4:false,5:false,6:false };
  (settings || []).forEach((s) => {
    weekdayIsClosed[s.weekday] = Boolean(s.is_closed);
  });

  // opening_hours map (fallback 1 Schicht)
  const openingByWeekday = {
    0: { open_time: "09:00", close_time: "17:00" },
    1: { open_time: "09:00", close_time: "17:00" },
    2: { open_time: "09:00", close_time: "17:00" },
    3: { open_time: "09:00", close_time: "17:00" },
    4: { open_time: "09:00", close_time: "17:00" },
    5: { open_time: "09:00", close_time: "17:00" },
    6: { open_time: "09:00", close_time: "17:00" }
  };
  (openingHours || []).forEach((o) => {
    openingByWeekday[o.weekday] = {
      open_time: String(o.open_time).slice(0,5),
      close_time: String(o.close_time).slice(0,5)
    };
  });

  // closed days
  const manualClosedSet = new Set((closedDays || []).map((c) => c.date));

  // sick map
  const sickByDate = {};
  (sickDays || []).forEach((s) => {
    if (!sickByDate[s.date]) sickByDate[s.date] = new Set();
    sickByDate[s.date].add(s.worker_id);
  });

  // fairness tracking
  const assignedHours = {};
  const targetHours = {};
  workers.forEach((w) => {
    assignedHours[w.id] = 0;
    targetHours[w.id] = Number(w.monthly_hours || 0);
  });

  // key `${date}__${workerId}` -> hours
  const entriesMap = {};

  function addHours(date, workerId, hours) {
    const key = `${date}__${workerId}`;
    entriesMap[key] = (entriesMap[key] || 0) + hours;
  }

  const totalDays = daysInMonth(year, month);

  for (let d = 1; d <= totalDays; d++) {
    const date = ymdFromParts(year, month, d);
    const weekday = weekdayOfDate(date);

    if (manualClosedSet.has(date)) continue;
    if (weekdayIsClosed[weekday]) continue;

    // Schichten laden
    const shifts = await getWeekdayShifts(weekday);

    let useShifts = shifts;

    // Fallback: keine Schichten => 1 Schicht aus Öffnungszeiten, 1 Arbeiter (deine Vorgabe)
    if (!useShifts || useShifts.length === 0) {
      const oh = openingByWeekday[weekday];
      useShifts = [
        {
          shift_index: 1,
          start_time: oh.open_time,
          end_time: oh.close_time,
          workers_needed: 1
        }
      ];
    }

    // Tagesbedarf in worker-hours + Slots (wie viele verschiedene Arbeiter maximal)
    let demandHours = 0;
    let slots = 0;

    for (const s of useShifts) {
      const workersNeeded = Number(s.workers_needed || 0); // 0 darf -> ignorieren
      if (workersNeeded <= 0) continue;

      const start = String(s.start_time).slice(0,5);
      const end = String(s.end_time).slice(0,5);

      const mins = minutesBetween(start, end);

      // Schichtdauer in ganzen Stunden (damit PDF sauber bleibt)
      const hours = Math.round(mins / 60);
      if (hours <= 0) continue;

      slots += workersNeeded;
      demandHours += hours * workersNeeded;
    }

    if (slots <= 0 || demandHours <= 0) continue;

    // verfügbare Worker
    const sickSet = sickByDate[date] || new Set();
    const available = workers.filter((w) => !sickSet.has(w.id));
    if (available.length === 0) continue;

    // ✅ WICHTIGER FIX:
    // Wir wählen GENAU so viele eindeutige Worker wie "slots" (oder weniger, wenn nicht genug verfügbar)
    const candidates = available
      .map((w) => ({
        w,
        remaining: targetHours[w.id] - assignedHours[w.id]
      }))
      .filter((x) => x.remaining > 0);

    if (candidates.length === 0) continue;

    candidates.sort((a, b) => b.remaining - a.remaining);

    // leichte Randomisierung in Top-K
    const k = Math.min(5, candidates.length);
    const ordered = [...shuffle(candidates.slice(0, k)), ...candidates.slice(k)];

    const chosen = ordered
      .slice(0, Math.min(slots, ordered.length))
      .map((x) => x.w);

    if (chosen.length === 0) continue;

    // Stunden nur innerhalb chosen verteilen
    let remainingDemand = demandHours;

    const usedToday = {};
    chosen.forEach((w) => (usedToday[w.id] = 0));

    while (remainingDemand > 0) {
      const pool = chosen
        .map((w) => ({
          w,
          remaining: targetHours[w.id] - assignedHours[w.id],
          dayCap: Number(w.max_hours_per_day) - usedToday[w.id]
        }))
        .filter((x) => x.remaining > 0 && x.dayCap > 0);

      if (pool.length === 0) break;

      pool.sort((a, b) => b.remaining - a.remaining);

      const pick = pool[0].w;

      addHours(date, pick.id, 1);
      assignedHours[pick.id] += 1;
      usedToday[pick.id] += 1;
      remainingDemand -= 1;
    }
  }

  const entries = Object.keys(entriesMap).map((key) => {
    const [date, worker_id] = key.split("__");
    return { date, worker_id, hours: entriesMap[key] };
  });

  const summary = workers.map((w) => ({
    worker_id: w.id,
    name: w.name,
    assigned_hours: assignedHours[w.id],
    target_hours: targetHours[w.id]
  }));

  return { year, month, entries, summary };
}