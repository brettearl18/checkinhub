import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb, isAdminConfigured } from "@/lib/firebase-admin";
import {
  STRIPE_CANCELLATION_GRACE_DAYS,
  clearStripeCancellationPending,
  closeClientAccount,
  parseClientTimestamp,
} from "@/lib/client-account-closure";
import { isClosedClientStatus } from "@/lib/client-status";

/**
 * Close accounts whose Stripe cancellation grace period (3 days) has elapsed.
 */
export async function runPendingStripeCancellationClosures(): Promise<{
  scanned: number;
  closed: number;
  cleared: number;
  skipped: number;
  errors: number;
}> {
  if (!isAdminConfigured()) {
    return { scanned: 0, closed: 0, cleared: 0, skipped: 0, errors: 0 };
  }

  const db = getAdminDb();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - STRIPE_CANCELLATION_GRACE_DAYS);

  const snap = await db
    .collection("clients")
    .where("stripeCancellationPendingAt", "<=", cutoff)
    .get();

  let closed = 0;
  let cleared = 0;
  let skipped = 0;
  let errors = 0;

  for (const doc of snap.docs) {
    const data = doc.data();
    const pendingAt = parseClientTimestamp(data.stripeCancellationPendingAt);
    if (!pendingAt || pendingAt.getTime() > cutoff.getTime()) {
      skipped += 1;
      continue;
    }

    if (isClosedClientStatus(data.status as string | undefined)) {
      await clearStripeCancellationPending(db, doc.id);
      cleared += 1;
      continue;
    }

    const subStatus = data.stripeSubscriptionStatus as string | undefined;
    if (subStatus === "active" || subStatus === "paused") {
      await clearStripeCancellationPending(db, doc.id);
      cleared += 1;
      continue;
    }

    try {
      await closeClientAccount(db, doc.id);
      await doc.ref.update({
        stripeCancellationPendingAt: FieldValue.delete(),
        updatedAt: new Date(),
      });
      closed += 1;
    } catch (err) {
      console.error("[stripe-closure-cron]", doc.id, err);
      errors += 1;
    }
  }

  return { scanned: snap.size, closed, cleared, skipped, errors };
}
