import { getAdminDb, isAdminConfigured } from "@/lib/firebase-admin";
import {
  addCalendarMonths,
  CLIENT_DELETION_WARNING_MONTHS_AFTER_CANCEL,
  parseClientTimestamp,
  resolveDataRetentionUntil,
} from "@/lib/client-account-closure";
import { sendClientDataDeletionWarningEmail } from "@/lib/client-cancelled-email";
import { buildDataDeletionLink, ensureDataDeletionToken } from "@/lib/client-data-deletion-token";
import { resolveAppBaseUrl } from "@/lib/app-url";
import { formatDateDisplay } from "@/lib/format-date";
import { purgeClientData } from "@/lib/purge-client-data";
import { todayPerth } from "@/lib/perth-date";

/**
 * Email cancelled clients at month 11 that data will be deleted in ~30 days.
 */
export async function runClientDataRetentionReminders(): Promise<{
  scanned: number;
  sent: number;
  skipped: number;
  errors: number;
}> {
  if (!isAdminConfigured()) {
    return { scanned: 0, sent: 0, skipped: 0, errors: 0 };
  }

  const db = getAdminDb();
  const today = todayPerth();
  const [cancelledSnap, archivedSnap] = await Promise.all([
    db.collection("clients").where("status", "==", "cancelled").get(),
    db.collection("clients").where("status", "==", "archived").get(),
  ]);

  const docs = [...cancelledSnap.docs];
  const seen = new Set(docs.map((d) => d.id));
  for (const doc of archivedSnap.docs) {
    if (!seen.has(doc.id)) docs.push(doc);
  }

  let sent = 0;
  let skipped = 0;
  let errors = 0;

  for (const doc of docs) {
    const data = doc.data();
    if (data.dataDeletionWarningEmailSentAt) {
      skipped += 1;
      continue;
    }

    const cancelledAt =
      parseClientTimestamp(data.cancelledAt) ??
      parseClientTimestamp(data.updatedAt);
    if (!cancelledAt) {
      skipped += 1;
      continue;
    }

    const warningOn = addCalendarMonths(cancelledAt, CLIENT_DELETION_WARNING_MONTHS_AFTER_CANCEL);
    const warningOnStr = warningOn.toLocaleDateString("en-CA", { timeZone: "Australia/Perth" });
    if (warningOnStr > today) {
      skipped += 1;
      continue;
    }

    const email = typeof data.email === "string" ? data.email.trim() : "";
    if (!email) {
      skipped += 1;
      continue;
    }

    const deletionDate = addCalendarMonths(cancelledAt, 12);
    const deletionDateDisplay = formatDateDisplay(deletionDate);
    const firstName = typeof data.firstName === "string" ? data.firstName : "";

    const tokenInfo = await ensureDataDeletionToken(db, doc.id);
    const deletionLink = tokenInfo
      ? buildDataDeletionLink(resolveAppBaseUrl(), tokenInfo.token, tokenInfo.email)
      : undefined;

    const result = await sendClientDataDeletionWarningEmail(
      email,
      firstName,
      deletionDateDisplay,
      deletionLink
    );
    if (!result.ok) {
      console.error("[client-data-retention-cron]", doc.id, result.error);
      errors += 1;
      continue;
    }

    await doc.ref.update({
      dataDeletionWarningEmailSentAt: new Date(),
      updatedAt: new Date(),
    });
    sent += 1;
  }

  return { scanned: docs.length, sent, skipped, errors };
}

/**
 * Permanently delete data for cancelled clients whose 12-month retention has ended.
 */
export async function runClientDataRetentionPurges(): Promise<{
  scanned: number;
  purged: number;
  skipped: number;
  errors: number;
}> {
  if (!isAdminConfigured()) {
    return { scanned: 0, purged: 0, skipped: 0, errors: 0 };
  }

  const db = getAdminDb();
  const today = todayPerth();
  const [cancelledSnap, archivedSnap] = await Promise.all([
    db.collection("clients").where("status", "==", "cancelled").get(),
    db.collection("clients").where("status", "==", "archived").get(),
  ]);

  const docs = [...cancelledSnap.docs];
  const seen = new Set(docs.map((d) => d.id));
  for (const doc of archivedSnap.docs) {
    if (!seen.has(doc.id)) docs.push(doc);
  }

  let purged = 0;
  let skipped = 0;
  let errors = 0;

  for (const doc of docs) {
    const data = doc.data();
    const retentionUntil = resolveDataRetentionUntil(data);
    if (!retentionUntil || retentionUntil > today) {
      skipped += 1;
      continue;
    }

    try {
      await purgeClientData(db, doc.id);
      purged += 1;
    } catch (err) {
      console.error("[client-data-retention-purge]", doc.id, err);
      errors += 1;
    }
  }

  return { scanned: docs.length, purged, skipped, errors };
}
