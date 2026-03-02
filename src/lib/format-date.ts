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
