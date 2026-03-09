export function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function getDaysInMonth(year, month) {
  // month: 1-12
  const days = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return days[month - 1];
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function formatDateLocal(year, month, day) {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

/**
 * Liefert ein 6x7 Grid (42 Felder), ABER: Montag ist Spalte 0, Sonntag Spalte 6.
 * Wichtig: weekday bleibt JS getDay() (0=So..6=Sa), damit settings weekday passt.
 */
export function getCalendarDays(year, month) {
  const daysInMonth = getDaysInMonth(year, month);

  const firstDay = new Date(year, month - 1, 1);
  const startWeekdaySunday0 = firstDay.getDay(); // 0=So..6=Sa

  // Umrechnung auf Montag-Start:
  // Mo=0, Di=1, ... So=6
  const startWeekdayMonday0 = (startWeekdaySunday0 + 6) % 7;

  const days = [];
  for (let i = 0; i < 42; i++) {
    const dayNumber = i - startWeekdayMonday0 + 1;

    if (dayNumber >= 1 && dayNumber <= daysInMonth) {
      const dateObj = new Date(year, month - 1, dayNumber);

      days.push({
        day: dayNumber,
        date: formatDateLocal(year, month, dayNumber),
        weekday: dateObj.getDay(), // 0=So..6=Sa (für settings)
        inMonth: true
      });
    } else {
      days.push({
        day: null,
        date: null,
        weekday: null,
        inMonth: false
      });
    }
  }

  return days;
}

export function getMonthNameDE(month) {
  const months = [
    "Januar", "Februar", "März", "April", "Mai", "Juni",
    "Juli", "August", "September", "Oktober", "November", "Dezember"
  ];
  return months[month - 1];
}