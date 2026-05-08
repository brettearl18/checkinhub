/**
 * Client roster status: soft-remove from default coach lists without deleting data.
 * Legacy Firestore value `archived` is treated the same as `cancelled`.
 */

const CLOSED = new Set(["cancelled", "archived"]);

/** True if client is off active roster (cancelled or legacy archived). */
export function isClosedClientStatus(status: string | undefined | null): boolean {
  return CLOSED.has((status ?? "").toLowerCase());
}

/** Normalize for writes: new canonical value is `cancelled`. */
export function normalizeClientStatusForStorage(status: string): string {
  const s = status.toLowerCase();
  if (s === "archived" || s === "cancelled") return "cancelled";
  return status;
}

/** API / UI: expose `cancelled` instead of legacy `archived`. */
export function normalizeClientStatusForApi(status: string | undefined | null): string {
  const raw = (status ?? "active").toLowerCase();
  if (raw === "archived" || raw === "cancelled") return "cancelled";
  if (raw === "pending") return "pending";
  if (raw === "active") return "active";
  return typeof status === "string" && status.length ? status : "active";
}

/** Coach UI label for status badge / table. */
export function formatClientStatusLabel(status: string | undefined | null): string {
  const api = normalizeClientStatusForApi(status);
  if (api === "active") return "Active";
  if (api === "pending") return "Pending";
  if (api === "cancelled") return "Cancelled";
  return status ? status.charAt(0).toUpperCase() + status.slice(1) : "—";
}
