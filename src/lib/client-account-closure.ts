import type { Firestore, Timestamp } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";
import { isClosedClientStatus, normalizeClientStatusForStorage } from "@/lib/client-status";
import {
  sendClientAccountClosedEmail,
  sendClientDataDeletionWarningEmail,
} from "@/lib/client-cancelled-email";
import { buildDataDeletionLink, ensureDataDeletionToken } from "@/lib/client-data-deletion-token";
import { resolveAppBaseUrl } from "@/lib/app-url";
import { formatDateDisplay } from "@/lib/format-date";

export const CLIENT_DATA_RETENTION_MONTHS = 12;
/** Send deletion warning this many months after cancellation (30 days before 12-month retention ends). */
export const CLIENT_DELETION_WARNING_MONTHS_AFTER_CANCEL = 11;
/** Wait this long after Stripe cancellation before closing account and sending the email. */
export const STRIPE_CANCELLATION_GRACE_DAYS = 3;

export function addCalendarMonths(date: Date, months: number): Date {
  const d = new Date(date.getTime());
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  if (d.getDate() !== day) d.setDate(0);
  return d;
}

export function parseClientTimestamp(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "object" && value !== null && "toDate" in value) {
    const d = (value as Timestamp).toDate();
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof value === "string") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

export function dataRetentionUntilFrom(cancelledAt: Date): string {
  return addCalendarMonths(cancelledAt, CLIENT_DATA_RETENTION_MONTHS)
    .toLocaleDateString("en-CA", { timeZone: "Australia/Perth" });
}

/** Resolve retention end date for a closed client record. */
export function resolveDataRetentionUntil(data: Record<string, unknown>): string | null {
  const stored = typeof data.dataRetentionUntil === "string" ? data.dataRetentionUntil : null;
  if (stored && /^\d{4}-\d{2}-\d{2}$/.test(stored)) return stored;
  const cancelledAt =
    parseClientTimestamp(data.cancelledAt) ?? parseClientTimestamp(data.updatedAt);
  if (!cancelledAt) return null;
  return dataRetentionUntilFrom(cancelledAt);
}

export function formatRetentionUntilDisplay(retentionUntil: string): string {
  return formatDateDisplay(retentionUntil);
}

/**
 * Mark client cancelled, set 12-month retention window, send account-closed email once.
 */
export async function closeClientAccount(
  db: Firestore,
  clientId: string,
  options?: { sendEmail?: boolean }
): Promise<{ ok: boolean; alreadyClosed: boolean; emailSent: boolean }> {
  const ref = db.collection("clients").doc(clientId);
  const snap = await ref.get();
  if (!snap.exists) {
    return { ok: false, alreadyClosed: false, emailSent: false };
  }

  const data = snap.data()!;
  const alreadyClosed = isClosedClientStatus(data.status as string | undefined);
  const now = new Date();
  const existingCancelledAt = parseClientTimestamp(data.cancelledAt);
  const cancelledAt = existingCancelledAt ?? now;

  const patch: Record<string, unknown> = {
    status: normalizeClientStatusForStorage("cancelled"),
    updatedAt: now,
  };
  if (!existingCancelledAt) {
    patch.cancelledAt = now;
  }
  if (!data.dataRetentionUntil) {
    patch.dataRetentionUntil = dataRetentionUntilFrom(cancelledAt);
  }
  const retentionUntil =
    typeof patch.dataRetentionUntil === "string"
      ? patch.dataRetentionUntil
      : typeof data.dataRetentionUntil === "string"
        ? data.dataRetentionUntil
        : dataRetentionUntilFrom(cancelledAt);
  const retentionUntilDisplay = formatRetentionUntilDisplay(retentionUntil);

  let emailSent = false;
  const shouldSendEmail = options?.sendEmail !== false && !data.accountClosedEmailSentAt;
  const email = typeof data.email === "string" ? data.email.trim() : "";
  const firstName = typeof data.firstName === "string" ? data.firstName : "";

  if (shouldSendEmail && email) {
    const tokenInfo = await ensureDataDeletionToken(db, clientId);
    const deletionLink = tokenInfo
      ? buildDataDeletionLink(resolveAppBaseUrl(), tokenInfo.token, tokenInfo.email)
      : undefined;
    const result = await sendClientAccountClosedEmail(
      email,
      firstName,
      retentionUntilDisplay,
      deletionLink
    );
    if (result.ok) {
      patch.accountClosedEmailSentAt = now;
      emailSent = true;
    } else {
      console.error("[closeClientAccount] account closed email failed:", result.error);
    }
  }

  await ref.update(patch);
  return { ok: true, alreadyClosed, emailSent };
}

/**
 * Stripe cancellation: start a grace period before account closure + email.
 * Cleared automatically if the client gets an active subscription again.
 */
export async function scheduleStripeCancellationClosure(
  db: Firestore,
  clientId: string
): Promise<void> {
  const ref = db.collection("clients").doc(clientId);
  const snap = await ref.get();
  if (!snap.exists) return;

  const data = snap.data()!;
  if (isClosedClientStatus(data.status as string | undefined)) return;
  if (data.stripeCancellationPendingAt) return;

  await ref.update({
    stripeCancellationPendingAt: new Date(),
    updatedAt: new Date(),
  });
}

/** Client resubscribed — cancel the pending Stripe closure. */
export async function clearStripeCancellationPending(db: Firestore, clientId: string): Promise<void> {
  const ref = db.collection("clients").doc(clientId);
  const snap = await ref.get();
  if (!snap.exists || !snap.data()?.stripeCancellationPendingAt) return;

  await ref.update({
    stripeCancellationPendingAt: FieldValue.delete(),
    updatedAt: new Date(),
  });
}

export async function scheduleStripeCancellationByCustomerId(
  db: Firestore,
  stripeCustomerId: string
): Promise<void> {
  const snap = await db
    .collection("clients")
    .where("stripeCustomerId", "==", stripeCustomerId)
    .limit(1)
    .get();
  if (snap.empty) return;
  await scheduleStripeCancellationClosure(db, snap.docs[0].id);
}

export async function getClientIdByStripeCustomerId(
  db: Firestore,
  stripeCustomerId: string
): Promise<string | null> {
  const snap = await db
    .collection("clients")
    .where("stripeCustomerId", "==", stripeCustomerId)
    .limit(1)
    .get();
  return snap.empty ? null : snap.docs[0].id;
}
