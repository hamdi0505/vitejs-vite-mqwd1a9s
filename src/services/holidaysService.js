// Feiertage über Nager.Date API
// https://date.nager.at/api/v3/PublicHolidays/{year}/{countryCode}
//
// Rückgabeformat für MonthSelector:
// { "YYYY-MM-DD": "Feiertagsname" }

const CACHE = new Map(); // key: `${year}-${countryCode}` -> array holidays

async function fetchHolidaysForYear(year, countryCode) {
  const key = `${year}-${countryCode}`;

  if (CACHE.has(key)) return CACHE.get(key);

  const res = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/${countryCode}`);
  if (!res.ok) {
    throw new Error(`Holiday API error: ${res.status}`);
  }

  const data = await res.json();
  CACHE.set(key, data);
  return data;
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

export async function getHolidaysForMonth(year, month, countryCode = "DE") {
  const all = await fetchHolidaysForYear(year, countryCode);

  const monthStr = `${year}-${pad2(month)}-`; // z.B. "2026-03-"
  const map = {};

  all.forEach((h) => {
    // h.date ist "YYYY-MM-DD"
    if (typeof h.date === "string" && h.date.startsWith(monthStr)) {
      // localName ist meist der deutsche Name, name ist englisch
      map[h.date] = h.localName || h.name || "Feiertag";
    }
  });

  return map;
}

// Optional: Cache leeren (falls du später Länder/Year wechselst und refresh willst)
export function clearHolidayCache() {
  CACHE.clear();
}