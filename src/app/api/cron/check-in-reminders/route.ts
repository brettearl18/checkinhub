import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { isAdminConfigured } from "@/lib/firebase-admin";
import { sendPushToUser } from "@/lib/push-server";
import { nextMondayPerth, thisMondayPerth } from "@/lib/perth-date";

const RESUMABLE_STATUSES = ["pending", "active", "overdue", "started"];

function requireCronSecret(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7) === secret;
  const header = request.headers.get("x-cron-secret");
  return header === secret;
}

/** Resolve client auth UID for notifications (userId in notifications collection). */
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

/**
 * POST /api/cron/check-in-reminders
 * Body: { "type": "open" | "closing" }
 * Headers: Authorization: Bearer <CRON_SECRET> or x-cron-secret: <CRON_SECRET>
 *
 * - open: Friday 9am Perth – notify clients with an assignment for next week (reflectionWeekStart = next Monday).
 * - closing: Monday 5pm Perth – notify clients with an open assignment for this week (reflectionWeekStart = this Monday).
 */
export async function POST(request: Request) {
  if (!requireCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { type?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const type = body.type === "open" || body.type === "closing" ? body.type : null;
  if (!type) {
    return NextResponse.json({ error: "Body must include type: 'open' or 'closing'" }, { status: 400 });
  }

  if (!isAdminConfigured()) {
    return NextResponse.json({ ok: true, sent: 0, message: "Database not configured" });
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
  const now = new Date();
  const title =
    type === "open"
      ? "Your check-in is open"
      : "Your check-in is closing today at 5pm";
  const message =
    type === "open"
      ? "Your weekly check-in for this week is now open. Take a few minutes to reflect and stay on track."
      : "Your weekly check-in closes today at 5pm Perth time. Complete it now if you haven’t already.";
  const actionUrl = "/client/check-in/new";

  for (const clientId of clientIds) {
    const userId = await getClientAuthUid(db, clientId);
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
  }

  return NextResponse.json({ ok: true, type, weekStart, sent, pushSent });
}
