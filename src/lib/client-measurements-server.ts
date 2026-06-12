import type { Firestore } from "firebase-admin/firestore";

export function parseMeasurementDateString(value: string | null | undefined): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) return null;
  const d = new Date(`${value.trim()}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function measurementDateKeyFromFirestore(dateVal: unknown): string | null {
  if (dateVal == null) return null;
  if (dateVal && typeof (dateVal as { toDate?: () => Date }).toDate === "function") {
    return (dateVal as { toDate: () => Date }).toDate().toISOString().slice(0, 10);
  }
  if (dateVal instanceof Date) return dateVal.toISOString().slice(0, 10);
  if (typeof dateVal === "string" && /^\d{4}-\d{2}-\d{2}/.test(dateVal)) {
    return dateVal.slice(0, 10);
  }
  return null;
}

export function isMeasurementDateInFuture(date: Date): boolean {
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  return date > today;
}

/** Earliest dated entry becomes the single baseline for charts and progress deltas. */
export async function reconcileMeasurementBaselines(db: Firestore, clientId: string): Promise<void> {
  const snap = await db
    .collection("client_measurements")
    .where("clientId", "==", clientId)
    .orderBy("date", "asc")
    .limit(200)
    .get();

  if (snap.empty) return;

  const dated = snap.docs
    .map((d) => ({
      id: d.id,
      ref: d.ref,
      dateKey: measurementDateKeyFromFirestore(d.data().date),
      isBaseline: d.data().isBaseline ?? false,
    }))
    .filter((d): d is typeof d & { dateKey: string } => Boolean(d.dateKey));

  if (dated.length === 0) return;

  dated.sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  const baselineId = dated[0]!.id;
  const now = new Date();

  await Promise.all(
    snap.docs.map((d) => {
      const shouldBeBaseline = d.id === baselineId;
      if ((d.data().isBaseline ?? false) === shouldBeBaseline) return Promise.resolve();
      return d.ref.update({ isBaseline: shouldBeBaseline, updatedAt: now });
    })
  );
}
