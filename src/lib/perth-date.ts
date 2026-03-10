/**
 * Perth (Australia/Perth) date helpers for cron: Friday 9am = check-in open, Monday 5pm = closing.
 * reflectionWeekStart is always a Monday in YYYY-MM-DD.
 */

const PERTH_TZ = "Australia/Perth";

/** Current date in Perth (YYYY-MM-DD). */
export function todayPerth(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: PERTH_TZ });
}

/** Format a Date as YYYY-MM-DD in Perth timezone (avoids UTC date shift). */
function toPerthDateString(d: Date): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: PERTH_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "0";
  const year = get("year");
  const month = get("month");
  const day = get("day");
  return `${year}-${month}-${day}`;
}

/** Next Monday in Perth (YYYY-MM-DD). Used for "check-in open" Friday run: week starting next Monday. */
export function nextMondayPerth(): string {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: PERTH_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  });
  const parts = formatter.formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const y = get("year");
  const m = get("month");
  const d = get("day");
  const weekday = get("weekday");
  const dayNum = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(weekday) + 1;
  const daysUntilNextMonday = dayNum === 1 ? 0 : dayNum === 7 ? 1 : 8 - dayNum;
  const perthNoon = new Date(`${y}-${m}-${d}T12:00:00+08:00`);
  const nextMondayTime = perthNoon.getTime() + daysUntilNextMonday * 24 * 60 * 60 * 1000;
  return toPerthDateString(new Date(nextMondayTime));
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
    weekday: "short",
  });
  const parts = formatter.formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const y = get("year");
  const m = get("month");
  const d = get("day");
  const weekday = get("weekday");
  const daysBackToMonday =
    weekday === "Sun" ? 6 : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(weekday);
  const perthNoon = new Date(`${y}-${m}-${d}T12:00:00+08:00`);
  const thisMondayTime = perthNoon.getTime() - daysBackToMonday * 24 * 60 * 60 * 1000;
  return toPerthDateString(new Date(thisMondayTime));
}
