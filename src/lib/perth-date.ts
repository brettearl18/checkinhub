/**
 * Perth (Australia/Perth) date helpers for cron: Friday 9am = check-in open, Monday 5pm = closing.
 * reflectionWeekStart is always a Monday in YYYY-MM-DD.
 */

const PERTH_TZ = "Australia/Perth";

/** Current date in Perth (YYYY-MM-DD). */
export function todayPerth(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: PERTH_TZ });
}

/** Next Monday in Perth (YYYY-MM-DD). Used for "check-in open" Friday run: week starting next Monday. */
export function nextMondayPerth(): string {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: PERTH_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "0";
  const year = parseInt(get("year"), 10);
  const month = parseInt(get("month"), 10) - 1;
  const day = parseInt(get("day"), 10);
  const perthDate = new Date(year, month, day);
  const dayOfWeek = perthDate.getDay();
  const daysUntilNextMonday = dayOfWeek === 0 ? 1 : dayOfWeek === 1 ? 0 : 8 - dayOfWeek;
  const nextMonday = new Date(perthDate);
  nextMonday.setDate(perthDate.getDate() + daysUntilNextMonday);
  return nextMonday.toISOString().slice(0, 10);
}

/**
 * Whether the check-in for the given week (Monday YYYY-MM-DD) has opened.
 * Opens Friday 9am Perth of that week. Use for "this week" and "next week" gating.
 */
export function isWeekOpenPerth(mondayYyyyMmDd: string): boolean {
  const [y, m, d] = mondayYyyyMmDd.split("-").map(Number);
  const mon = new Date(y, m - 1, d);
  const fri = new Date(mon);
  fri.setDate(mon.getDate() + 4);
  const year = fri.getFullYear();
  const month = String(fri.getMonth() + 1).padStart(2, "0");
  const day = String(fri.getDate()).padStart(2, "0");
  const friStr = `${year}-${month}-${day}`;
  const friday9amPerth = new Date(`${friStr}T09:00:00+08:00`);
  return Date.now() >= friday9amPerth.getTime();
}

/** This Monday in Perth (YYYY-MM-DD). Used for "check-in closing" Monday 5pm run: week closing today. */
export function thisMondayPerth(): string {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: PERTH_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "0";
  const year = parseInt(get("year"), 10);
  const month = parseInt(get("month"), 10) - 1;
  const day = parseInt(get("day"), 10);
  const perthDate = new Date(year, month, day);
  const dayOfWeek = perthDate.getDay();
  const daysBackToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const thisMonday = new Date(perthDate);
  thisMonday.setDate(perthDate.getDate() - daysBackToMonday);
  return thisMonday.toISOString().slice(0, 10);
}
