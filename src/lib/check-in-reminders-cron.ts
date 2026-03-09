import { getAdminDb } from "@/lib/firebase-admin";
import { isAdminConfigured } from "@/lib/firebase-admin";
import { sendEmail } from "@/lib/email-service";
import { sendPushToUser } from "@/lib/push-server";
import { nextMondayPerth, thisMondayPerth } from "@/lib/perth-date";

const RESUMABLE_STATUSES = ["pending", "active", "overdue", "started"];

export function requireCronSecret(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7) === secret;
  const header = request.headers.get("x-cron-secret");
  return header === secret;
}

async function getClientAuthUid(
  db: ReturnType<typeof getAdminDb>,
  clientId: string
): Promise<string | null> {
  const clientSnap = await db.collection("clients").doc(clientId).get();
  if (!clientSnap.exists) return null;
  const data = clientSnap.data() as { authUid?: string; email?: string };
  if (data.authUid) return data.authUid;
  if (data.email) {
    const usersSnap = await db.collection("users").where("email", "==", data.email).limit(1).get();
    if (!usersSnap.empty) return usersSnap.docs[0].id;
  }
  return clientId;
}

export type ReminderType = "open" | "closing";

const ACTION_URL = "/client/check-in/new";

/** Build subject, html, and text for a reminder email (for cron or test). */
export function buildReminderEmailContent(
  type: ReminderType,
  firstName: string,
  appUrl: string
): { subject: string; html: string; text: string } {
  const loginUrl = `${appUrl.replace(/\/$/, "")}${ACTION_URL}`;
  const subject =
    type === "open"
      ? "Your check-in is open"
      : "Your check-in is closing today at 5pm";
  const bodyCopy =
    type === "open"
      ? "Your check-in for this week is now open. Log in to complete it and stay on track with your coach."
      : "Your weekly check-in closes today at 5pm Perth time. Complete it now if you haven't already.";
  const buttonLabel = type === "open" ? "Complete your check-in" : "Complete check-in";
  const message =
    type === "open"
      ? "Your check-in for this week is now open. Log in to complete it."
      : "Your weekly check-in closes today at 5pm Perth time. Complete it now if you haven't already.";
  const html = `
    <p>Hi ${firstName},</p>
    <p>${bodyCopy}</p>
    <p><a href="${loginUrl}" style="display:inline-block;background:#c9a227;color:#fff;padding:10px 20px;text-decoration:none;border-radius:6px;font-weight:600;">${buttonLabel}</a></p>
    <p><a href="${loginUrl}">${loginUrl}</a></p>
    <p>Best,<br>CheckinHUB</p>
  `.trim();
  const text = `Hi ${firstName},\n\n${message}\n\n${loginUrl}\n\nBest,\nCheckinHUB`;
  return { subject, html, text };
}

export type RunRemindersResult =
  | { ok: true; type: ReminderType; weekStart: string; sent: number; pushSent: number; emailSent: number }
  | { ok: true; sent: number; message: string };

export async function runReminders(type: ReminderType): Promise<RunRemindersResult> {
  if (!isAdminConfigured()) {
    return { ok: true, sent: 0, message: "Database not configured" };
  }

  const db = getAdminDb();
  const weekStart = type === "open" ? nextMondayPerth() : thisMondayPerth();

  const assignSnap = await db
    .collection("check_in_assignments")
    .where("reflectionWeekStart", "==", weekStart)
    .where("status", "in", RESUMABLE_STATUSES)
    .get();

  const clientIds = new Set<string>();
  for (const d of assignSnap.docs) {
    const clientId = (d.data() as { clientId?: string }).clientId;
    if (clientId) clientIds.add(clientId);
  }

  let sent = 0;
  let pushSent = 0;
  let emailSent = 0;
  const now = new Date();
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
  const appUrl = baseUrl.replace(/\/$/, "");
  const title =
    type === "open"
      ? "Check In is now Open"
      : "Your check-in is closing today at 5pm";
  const message =
    type === "open"
      ? "Your check-in for this week is now open. Log in to complete it."
      : "Your weekly check-in closes today at 5pm Perth time. Complete it now if you haven't already.";
  const actionUrl = ACTION_URL;

  for (const clientId of clientIds) {
    const clientSnap = await db.collection("clients").doc(clientId).get();
    const clientData = clientSnap.exists
      ? (clientSnap.data() as { authUid?: string; email?: string; firstName?: string })
      : null;
    const userId = clientData?.authUid ?? (await getClientAuthUid(db, clientId));
    if (!userId) continue;
    await db.collection("notifications").add({
      userId,
      type: type === "open" ? "check_in_open" : "check_in_closing",
      title,
      message,
      actionUrl,
      metadata: { clientId, reflectionWeekStart: weekStart },
      isRead: false,
      createdAt: now,
    });
    sent++;
    try {
      const result = await sendPushToUser({
        userId,
        title,
        body: message,
        actionPath: actionUrl,
        tag: type === "open" ? "check_in_open" : "check_in_closing",
      });
      pushSent += result.sent;
    } catch {
      // continue; in-app notification already saved
    }
    if (clientData?.email?.trim() && appUrl) {
      const firstName = clientData.firstName?.trim() || "there";
      const { subject, html, text } = buildReminderEmailContent(type, firstName, appUrl);
      const emailResult = await sendEmail({
        to: clientData.email,
        subject,
        html,
        text,
      });
      if (emailResult.ok) emailSent++;
    }
  }

  return { ok: true, type, weekStart, sent, pushSent, emailSent };
}
