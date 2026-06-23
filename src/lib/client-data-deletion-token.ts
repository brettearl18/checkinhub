import crypto from "crypto";
import type { Firestore } from "firebase-admin/firestore";
import { Timestamp } from "firebase-admin/firestore";
import { CLIENT_DATA_RETENTION_MONTHS, addCalendarMonths, parseClientTimestamp } from "@/lib/client-account-closure";

export function buildDataDeletionLink(baseUrl: string, token: string, email: string): string {
  const root = baseUrl.replace(/\/$/, "");
  const path = `/delete-my-data?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;
  return root ? `${root}${path}` : path;
}

function tokenExpiryFromClient(data: Record<string, unknown>): Date {
  const retention = typeof data.dataRetentionUntil === "string" ? data.dataRetentionUntil : null;
  if (retention && /^\d{4}-\d{2}-\d{2}$/.test(retention)) {
    const d = new Date(`${retention}T23:59:59+08:00`);
    d.setDate(d.getDate() + 30);
    return d;
  }
  const cancelledAt = parseClientTimestamp(data.cancelledAt) ?? new Date();
  return addCalendarMonths(cancelledAt, CLIENT_DATA_RETENTION_MONTHS + 1);
}

export async function ensureDataDeletionToken(
  db: Firestore,
  clientId: string
): Promise<{ token: string; email: string } | null> {
  const ref = db.collection("clients").doc(clientId);
  const snap = await ref.get();
  if (!snap.exists) return null;
  const data = snap.data()!;
  const email = typeof data.email === "string" ? data.email.trim().toLowerCase() : "";
  if (!email) return null;

  const existingToken =
    typeof data.dataDeletionToken === "string" && data.dataDeletionToken.trim()
      ? data.dataDeletionToken.trim()
      : null;
  const expiry = parseClientTimestamp(data.dataDeletionTokenExpiry);
  if (existingToken && expiry && expiry.getTime() > Date.now()) {
    return { token: existingToken, email };
  }

  const token = crypto.randomBytes(32).toString("hex");
  const tokenExpiry = tokenExpiryFromClient(data);
  await ref.update({
    dataDeletionToken: token,
    dataDeletionTokenExpiry: Timestamp.fromDate(tokenExpiry),
    updatedAt: new Date(),
  });
  return { token, email };
}

export async function verifyDataDeletionToken(
  db: Firestore,
  token: string,
  email: string
): Promise<
  | { ok: true; clientId: string; firstName: string; email: string }
  | { ok: false; error: string }
> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!token || !normalizedEmail) {
    return { ok: false, error: "Token and email are required." };
  }

  const snap = await db
    .collection("clients")
    .where("dataDeletionToken", "==", token)
    .where("email", "==", normalizedEmail)
    .limit(1)
    .get();

  if (snap.empty) {
    return { ok: false, error: "Invalid or expired link." };
  }

  const doc = snap.docs[0];
  const data = doc.data();
  const expiry = parseClientTimestamp(data.dataDeletionTokenExpiry);
  if (expiry && expiry.getTime() < Date.now()) {
    return { ok: false, error: "This link has expired. Contact info@vanahealth.com.au for help." };
  }

  return {
    ok: true,
    clientId: doc.id,
    firstName: typeof data.firstName === "string" ? data.firstName : "",
    email: normalizedEmail,
  };
}