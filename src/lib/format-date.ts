/**
 * Return local date as YYYY-MM-DD. Use for week boundaries so "this week" matches the user's calendar (avoids UTC shift).
 */
export function toLocalDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Display as DD/MM/YYYY (e.g. 16/03/2026). For `YYYY-MM-DD` calendar keys, splits the string so the day is never shifted by timezone.
 */
export function formatDateDdMmYyyy(value: string | null | undefined): string {
  if (value == null || value === "") return "—";
  const s = String(value).trim();
  const isoDay = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (isoDay) {
    const [, y, mo, da] = isoDay;
    return `${da}/${mo}/${y}`;
  }
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "—";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Site-wide display format: DD MMM YYYY (e.g. 01 Mar 2026).
 * Use for all user-visible dates.
 */
export function formatDateDisplay(
  value: string | Date | number | null | undefined
): string {
  if (value == null) return "—";
  const d = typeof value === "object" && "getTime" in value
    ? value
    : new Date(typeof value === "number" ? value : String(value));
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/**
 * Same as formatDateDisplay but for date+time (e.g. 01 Mar 2026, 10:30).
 */
export function formatDateTimeDisplay(
  value: string | Date | number | null | undefined
): string {
  if (value == null) return "—";
  const d = typeof value === "object" && "getTime" in value
    ? value
    : new Date(typeof value === "number" ? value : String(value));
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Month + year from a calendar date key (e.g. "May 2026").
 */
export function formatMonthYearDisplay(value: string | null | undefined): string | null {
  if (value == null || value === "") return null;
  const isoDay = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value).trim());
  if (!isoDay) return null;
  const d = new Date(`${isoDay[0]}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}
