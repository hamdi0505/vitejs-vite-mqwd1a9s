import { supabase } from "../lib/supabaseClient";
import { emit, EVENTS } from "./eventBus";

export async function testConnection() {
  const { data, error } = await supabase.from("workers").select("*").limit(1);

  if (error) {
    console.error("Supabase connection error:", error);
    throw error;
  }

  return data;
}

export async function getWorkers() {
  const { data, error } = await supabase.from("workers").select("*").order("name");

  if (error) {
    console.error("Error loading workers:", error);
    throw error;
  }

  return data;
}

export async function addWorker(name) {
  const { data, error } = await supabase
    .from("workers")
    .insert([
      {
        name: name,
        monthly_hours: 0,
        max_hours_per_day: 0
      }
    ])
    .select();

  if (error) {
    console.error("Error adding worker:", error);
    throw error;
  }

  emit(EVENTS.DATA_CHANGED, { table: "workers", action: "insert" });
  return data;
}

export async function updateWorker(id, updates) {
  const { data, error } = await supabase.from("workers").update(updates).eq("id", id).select();

  if (error) {
    console.error("Error updating worker:", error);
    throw error;
  }

  emit(EVENTS.DATA_CHANGED, { table: "workers", action: "update" });
  return data;
}

export async function deleteWorker(id) {
  const { error } = await supabase.from("workers").delete().eq("id", id);

  if (error) {
    console.error("Error deleting worker:", error);
    throw error;
  }

  emit(EVENTS.DATA_CHANGED, { table: "workers", action: "delete" });
}

/**
 * CLOSED DAYS (Phase 4)
 */
export async function getClosedDaysInRange(startDate, endDate) {
  const { data, error } = await supabase
    .from("closed_days")
    .select("*")
    .gte("date", startDate)
    .lte("date", endDate)
    .order("date");

  if (error) {
    console.error("Error loading closed days:", error);
    throw error;
  }

  return data;
}

export async function addClosedDay(date) {
  const { data, error } = await supabase
    .from("closed_days")
    .insert([{ date: date, is_closed: true }])
    .select();

  if (error) {
    console.error("Error adding closed day:", error);
    throw error;
  }

  emit(EVENTS.DATA_CHANGED, { table: "closed_days", action: "insert" });
  return data;
}

export async function removeClosedDay(date) {
  const { error } = await supabase.from("closed_days").delete().eq("date", date);

  if (error) {
    console.error("Error removing closed day:", error);
    throw error;
  }

  emit(EVENTS.DATA_CHANGED, { table: "closed_days", action: "delete" });
}

/**
 * SETTINGS (Phase 4 / Phase 6)
 */
export async function getWeekdaySettings() {
  const { data, error } = await supabase.from("settings").select("*").order("weekday");

  if (error) {
    console.error("Error loading weekday settings:", error);
    throw error;
  }

  return data;
}

export async function setWeekdayClosed(weekday, isClosed) {
  const { data: existing, error: findError } = await supabase
    .from("settings")
    .select("*")
    .eq("weekday", weekday)
    .limit(1);

  if (findError) {
    console.error("Error finding weekday setting:", findError);
    throw findError;
  }

  if (existing && existing.length > 0) {
    const row = existing[0];
    const { data, error } = await supabase
      .from("settings")
      .update({ is_closed: isClosed })
      .eq("id", row.id)
      .select();

    if (error) {
      console.error("Error updating weekday setting:", error);
      throw error;
    }

    emit(EVENTS.DATA_CHANGED, { table: "settings", action: "update" });
    return data;
  } else {
    const { data, error } = await supabase
      .from("settings")
      .insert([
        {
          weekday: weekday,
          is_closed: isClosed,
          max_workers: 0
        }
      ])
      .select();

    if (error) {
      console.error("Error inserting weekday setting:", error);
      throw error;
    }

    emit(EVENTS.DATA_CHANGED, { table: "settings", action: "insert" });
    return data;
  }
}

export async function setWeekdayMaxWorkers(weekday, maxWorkers) {
  const { data: existing, error: findError } = await supabase
    .from("settings")
    .select("*")
    .eq("weekday", weekday)
    .limit(1);

  if (findError) {
    console.error("Error finding weekday setting:", findError);
    throw findError;
  }

  const value = Number(maxWorkers);

  if (existing && existing.length > 0) {
    const row = existing[0];

    const { data, error } = await supabase
      .from("settings")
      .update({ max_workers: value })
      .eq("id", row.id)
      .select();

    if (error) {
      console.error("Error updating weekday max_workers:", error);
      throw error;
    }

    emit(EVENTS.DATA_CHANGED, { table: "settings", action: "update" });
    return data;
  } else {
    const { data, error } = await supabase
      .from("settings")
      .insert([
        {
          weekday: weekday,
          is_closed: false,
          max_workers: value
        }
      ])
      .select();

    if (error) {
      console.error("Error inserting weekday max_workers:", error);
      throw error;
    }

    emit(EVENTS.DATA_CHANGED, { table: "settings", action: "insert" });
    return data;
  }
}

/**
 * SICK DAYS (Phase 5)
 */
export async function getSickDaysInRange(startDate, endDate) {
  const { data, error } = await supabase
    .from("sick_days")
    .select("*")
    .gte("date", startDate)
    .lte("date", endDate)
    .order("date");

  if (error) {
    console.error("Error loading sick days:", error);
    throw error;
  }

  return data;
}

export async function addSickDay(workerId, date) {
  const { data, error } = await supabase
    .from("sick_days")
    .insert([{ worker_id: workerId, date: date }])
    .select();

  if (error) {
    console.error("Error adding sick day:", error);
    throw error;
  }

  emit(EVENTS.DATA_CHANGED, { table: "sick_days", action: "insert" });
  return data;
}

export async function removeSickDay(workerId, date) {
  const { error } = await supabase
    .from("sick_days")
    .delete()
    .eq("worker_id", workerId)
    .eq("date", date);

  if (error) {
    console.error("Error removing sick day:", error);
    throw error;
  }

  emit(EVENTS.DATA_CHANGED, { table: "sick_days", action: "delete" });
}

/**
 * LOGIN TABLES (Phase-Login)
 * worker_accounts: worker_id, username, password_hash
 */
export async function createWorkerWithAccount(name, username, passwordHash) {
  const { data: workerData, error: workerError } = await supabase
    .from("workers")
    .insert([
      {
        name: name,
        monthly_hours: 0,
        max_hours_per_day: 0
      }
    ])
    .select()
    .limit(1);

  if (workerError) {
    console.error("Error creating worker:", workerError);
    throw workerError;
  }

  const worker = workerData[0];

  const { data: accountData, error: accountError } = await supabase
    .from("worker_accounts")
    .insert([
      {
        worker_id: worker.id,
        username: username,
        password_hash: passwordHash
      }
    ])
    .select()
    .limit(1);

  if (accountError) {
    console.error("Error creating worker account:", accountError);
    throw accountError;
  }

  emit(EVENTS.DATA_CHANGED, { table: "workers", action: "insert" });
  emit(EVENTS.DATA_CHANGED, { table: "worker_accounts", action: "insert" });

  return {
    worker,
    account: accountData[0]
  };
}

export async function getWorkerAccounts() {
  const { data, error } = await supabase
    .from("worker_accounts")
    .select("id, worker_id, username, is_active, created_at, workers(name)")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error loading worker accounts:", error);
    throw error;
  }

  return data;
}

export async function updateWorkerUsername(workerId, newUsername) {
  const { data, error } = await supabase
    .from("worker_accounts")
    .update({ username: newUsername })
    .eq("worker_id", workerId)
    .select()
    .limit(1);

  if (error) {
    console.error("Error updating worker username:", error);
    throw error;
  }

  emit(EVENTS.DATA_CHANGED, { table: "worker_accounts", action: "update" });
  return data;
}

export async function resetWorkerPassword(workerId, newPasswordHash) {
  const { data, error } = await supabase
    .from("worker_accounts")
    .update({ password_hash: newPasswordHash })
    .eq("worker_id", workerId)
    .select()
    .limit(1);

  if (error) {
    console.error("Error resetting worker password:", error);
    throw error;
  }

  emit(EVENTS.DATA_CHANGED, { table: "worker_accounts", action: "update" });
  return data;
}
export async function setWorkerAccountActive(workerId, isActive) {
  const { data, error } = await supabase
    .from("worker_accounts")
    .update({ is_active: isActive })
    .eq("worker_id", workerId)
    .select()
    .limit(1);

  if (error) {
    console.error("Error updating worker account active state:", error);
    throw error;
  }

  emit(EVENTS.DATA_CHANGED, { table: "worker_accounts", action: "update" });
  return data;
}
/**
 * SCHEDULES / ARCHIV (Phase Archiv)
 * schedules: id, month, year
 * schedule_entries: id, schedule_id, worker_id, date
 */

// Plan (Monat/Jahr) erstellen
export async function createSchedule(month, year) {
  const { data, error } = await supabase
    .from("schedules")
    .insert([{ month, year }])
    .select()
    .limit(1);

  if (error) {
    console.error("Error creating schedule:", error);
    throw error;
  }

  emit(EVENTS.DATA_CHANGED, { table: "schedules", action: "insert" });
  return data[0];
}

// Alle gespeicherten Pläne laden (neueste zuerst)
export async function getSchedules() {
  const { data, error } = await supabase
    .from("schedules")
    .select("*")
    .order("year", { ascending: false })
    .order("month", { ascending: false });

  if (error) {
    console.error("Error loading schedules:", error);
    throw error;
  }

  return data;
}

// Alle Einträge eines Plans laden
export async function getScheduleEntries(scheduleId) {
  const { data, error } = await supabase
    .from("schedule_entries")
    .select("*")
    .eq("schedule_id", scheduleId)
    .order("date");

  if (error) {
    console.error("Error loading schedule entries:", error);
    throw error;
  }

  return data;
}

// Einträge eines Plans im Von–Bis Zeitraum (für späteren PDF Export)
export async function getScheduleEntriesInRange(scheduleId, startDate, endDate) {
  const { data, error } = await supabase
    .from("schedule_entries")
    .select("*")
    .eq("schedule_id", scheduleId)
    .gte("date", startDate)
    .lte("date", endDate)
    .order("date");

  if (error) {
    console.error("Error loading schedule entries in range:", error);
    throw error;
  }

  return data;
}
/**
 * Phase 7 braucht das: Schedule Entries speichern
 * entries erwartet Array von:
 * { schedule_id, worker_id, date }
 */
 export async function insertScheduleEntries(entries) {
  const { data, error } = await supabase
    .from("schedule_entries")
    .insert(entries)
    .select();

  if (error) {
    console.error("Error inserting schedule entries:", error);
    throw error;
  }

  emit(EVENTS.DATA_CHANGED, { table: "schedule_entries", action: "insert" });
  return data;
}
/**
 * OPENING HOURS (Öffnungszeiten)
 * opening_hours: weekday (0-6), is_closed, open_time, close_time
 */

 export async function getOpeningHours() {
  const { data, error } = await supabase
    .from("opening_hours")
    .select("*")
    .order("weekday");

  if (error) {
    console.error("Error loading opening hours:", error);
    throw error;
  }

  return data;
}

export async function upsertOpeningHour(weekday, isClosed, openTime, closeTime) {
  // erst prüfen ob row existiert
  const { data: existing, error: findError } = await supabase
    .from("opening_hours")
    .select("*")
    .eq("weekday", weekday)
    .limit(1);

  if (findError) {
    console.error("Error finding opening hour:", findError);
    throw findError;
  }

  if (existing && existing.length > 0) {
    const row = existing[0];

    const { data, error } = await supabase
      .from("opening_hours")
      .update({
        is_closed: isClosed,
        open_time: openTime,
        close_time: closeTime
      })
      .eq("id", row.id)
      .select();

    if (error) {
      console.error("Error updating opening hour:", error);
      throw error;
    }

    emit(EVENTS.DATA_CHANGED, { table: "opening_hours", action: "update" });
    return data;
  } else {
    const { data, error } = await supabase
      .from("opening_hours")
      .insert([
        {
          weekday,
          is_closed: isClosed,
          open_time: openTime,
          close_time: closeTime
        }
      ])
      .select();

    if (error) {
      console.error("Error inserting opening hour:", error);
      throw error;
    }

    emit(EVENTS.DATA_CHANGED, { table: "opening_hours", action: "insert" });
    return data;
  }
}
/**
 * WEEKDAY SHIFTS (Schichten pro Wochentag)
 * weekday_shifts: weekday, shift_index, start_time, end_time, workers_needed
 */

 export async function getWeekdayShifts(weekday) {
  const { data, error } = await supabase
    .from("weekday_shifts")
    .select("*")
    .eq("weekday", weekday)
    .order("shift_index");

  if (error) {
    console.error("Error loading weekday shifts:", error);
    throw error;
  }

  return data;
}

// Speichert die komplette Schicht-Konfiguration für einen Wochentag neu
// (wir löschen alte Zeilen und inserten neu)
export async function saveWeekdayShifts(weekday, shifts) {
  // shifts: [{ shift_index, start_time, end_time, workers_needed }, ...]
  const { error: delError } = await supabase
    .from("weekday_shifts")
    .delete()
    .eq("weekday", weekday);

  if (delError) {
    console.error("Error deleting weekday shifts:", delError);
    throw delError;
  }

  if (!shifts || shifts.length === 0) {
    emit(EVENTS.DATA_CHANGED, { table: "weekday_shifts", action: "update" });
    return [];
  }

  const payload = shifts.map((s) => ({
    weekday,
    shift_index: s.shift_index,
    start_time: s.start_time,
    end_time: s.end_time,
    workers_needed: Number(s.workers_needed || 0)
  }));

  const { data, error } = await supabase
    .from("weekday_shifts")
    .insert(payload)
    .select();

  if (error) {
    console.error("Error inserting weekday shifts:", error);
    throw error;
  }

  emit(EVENTS.DATA_CHANGED, { table: "weekday_shifts", action: "update" });
  return data;
}
/**
 * Archiv: Plan löschen (Schedule + Entries)
 */
 export async function deleteSchedule(scheduleId) {
  // 1) Erst Einträge löschen
  const { error: entriesError } = await supabase
    .from("schedule_entries")
    .delete()
    .eq("schedule_id", scheduleId);

  if (entriesError) {
    console.error("Error deleting schedule entries:", entriesError);
    throw entriesError;
  }

  // 2) Dann Schedule löschen
  const { error: scheduleError } = await supabase
    .from("schedules")
    .delete()
    .eq("id", scheduleId);

  if (scheduleError) {
    console.error("Error deleting schedule:", scheduleError);
    throw scheduleError;
  }

  emit(EVENTS.DATA_CHANGED, { table: "schedule_entries", action: "delete" });
  emit(EVENTS.DATA_CHANGED, { table: "schedules", action: "delete" });
}