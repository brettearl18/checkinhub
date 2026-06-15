import { todayPerth } from "@/lib/perth-date";

const RESUMABLE_STATUSES = new Set(["pending", "active", "overdue", "started"]);

export function isResumableAssignmentStatus(status: string | null | undefined): boolean {
  return RESUMABLE_STATUSES.has((status ?? "").trim());
}

function assignmentDateKey(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string") {
    const match = /^(\d{4}-\d{2}-\d{2})/.exec(value.trim());
    return match ? match[1]! : null;
  }
  if (value && typeof (value as { toDate?: () => Date }).toDate === "function") {
    const iso = (value as { toDate: () => Date }).toDate().toISOString();
    const match = /^(\d{4}-\d{2}-\d{2})/.exec(iso);
    return match ? match[1]! : null;
  }
  if (value instanceof Date) {
    const match = /^(\d{4}-\d{2}-\d{2})/.exec(value.toISOString());
    return match ? match[1]! : null;
  }
  return null;
}

/** Pick status when undoing a skipped assignment (legacy rows may lack statusBeforeSkipped). */
export function statusAfterUndoSkipped(data: {
  statusBeforeSkipped?: string | null;
  dueDate?: unknown;
}): string {
  const previous = (data.statusBeforeSkipped ?? "").trim();
  if (isResumableAssignmentStatus(previous)) return previous;

  const dueKey = assignmentDateKey(data.dueDate);
  if (dueKey && dueKey < todayPerth()) return "overdue";
  return "pending";
}
