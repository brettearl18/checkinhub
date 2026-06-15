import { formatDateDisplay } from "@/lib/format-date";
import { todayPerth } from "@/lib/perth-date";

export function parseProgressPhotoDateString(value: string | null | undefined): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) return null;
  return new Date(`${value.trim()}T12:00:00+08:00`);
}

export function isProgressPhotoDateInFuture(dateKey: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return true;
  return dateKey > todayPerth();
}

/** Calendar day from stored ISO / Firestore string — avoids timezone shifting the label. */
export function progressPhotoCalendarKey(uploadedAt: string | null | undefined): string | null {
  if (!uploadedAt) return null;
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(uploadedAt.trim());
  return match ? match[1]! : null;
}

export function formatProgressPhotoDate(uploadedAt: string | null | undefined): string {
  const key = progressPhotoCalendarKey(uploadedAt);
  if (!key) return "";
  return formatDateDisplay(`${key}T12:00:00+08:00`);
}

/** YYYY-MM-DD for date inputs when editing stored photos. */
export function progressPhotoDateInputFromStored(uploadedAt: string | null | undefined): string {
  return progressPhotoCalendarKey(uploadedAt) ?? "";
}
