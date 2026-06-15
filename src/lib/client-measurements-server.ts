import type { Firestore } from "firebase-admin/firestore";
import { todayPerth } from "@/lib/perth-date";

export function parseMeasurementDateString(value: string | null | undefined): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) return null;
  const key = value.trim();
  // Noon Perth keeps the calendar day stable in Firestore regardless of server TZ.
  const d = new Date(`${key}T12:00:00+08:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function measurementDateKeyFromFirestore(dateVal: unknown): string | null {
  if (dateVal == null) return null;
  if (typeof dateVal === "string") {
    const match = /^(\d{4}-\d{2}-\d{2})/.exec(dateVal.trim());
    return match ? match[1]! : null;
  }
  if (dateVal && typeof (dateVal as { toDate?: () => Date }).toDate === "function") {
    const iso = (dateVal as { toDate: () => Date }).toDate().toISOString();
    const match = /^(\d{4}-\d{2}-\d{2})/.exec(iso);
    return match ? match[1]! : null;
  }
  if (dateVal instanceof Date) {
    const match = /^(\d{4}-\d{2}-\d{2})/.exec(dateVal.toISOString());
    return match ? match[1]! : null;
  }
  return null;
}

export function isMeasurementDateInFuture(dateKey: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return true;
  return dateKey > todayPerth();
}

/** Earliest dated entry becomes the single baseline for charts and progress deltas. */
export async function reconcileMeasurementBaselines(db: Firestore, clientId: string): Promise<void> {
  const snap = await db
    .collection("client_measurements")
    .where("clientId", "==", clientId)
    .orderBy("date", "desc")
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
