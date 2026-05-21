import type { Firestore } from "firebase-admin/firestore";

/** Normalize coach invite / shortUID codes for comparison. */
export function normalizeCoachCode(code: string): string {
  return code.trim().toUpperCase();
}

/**
 * Resolve an active coach by `coaches.shortUID` (case-insensitive).
 * Returns the coach Firebase uid or null if not found.
 */
export async function resolveCoachIdByShortUid(
  db: Firestore,
  code: string
): Promise<string | null> {
  const normalized = normalizeCoachCode(code);
  if (!normalized) return null;

  const snap = await db
    .collection("coaches")
    .where("shortUID", "==", normalized)
    .limit(1)
    .get();

  if (!snap.empty) return snap.docs[0].id;
  return null;
}
