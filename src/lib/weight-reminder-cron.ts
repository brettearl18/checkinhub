import { getAdminDb } from "@/lib/firebase-admin";
import { isAdminConfigured } from "@/lib/firebase-admin";
import { sendPushToUser } from "@/lib/push-server";
import { getPerthDayBoundsUtc, todayPerth } from "@/lib/perth-date";

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

const ACTION_PATH = "/client/profile#body-weight";

/**
 * 7:00 Australia/Perth daily: remind clients to log body weight (push + in-app), if not yet today.
 * Intended cron: 0 23 * * * (UTC) → 7:00 Perth.
 */
export async function runWeightRemindersPerth(): Promise<{
  ok: true;
  perthDate: string;
  checked: number;
  reminded: number;
  skippedLogged: number;
  pushSent: number;
}> {
  if (!isAdminConfigured()) {
    return { ok: true, perthDate: todayPerth(), checked: 0, reminded: 0, skippedLogged: 0, pushSent: 0 };
  }

  const db = getAdminDb();
  const perthDate = todayPerth();
  const { start, end } = getPerthDayBoundsUtc(perthDate);
  const now = new Date();

  const title = "Log your body weight";
  const message = "Add today’s weight on your profile — quick daily check-in.";

  const clientsSnap = await db.collection("clients").get();
  let checked = 0;
  let reminded = 0;
  let skippedLogged = 0;
  let pushSent = 0;

  for (const doc of clientsSnap.docs) {
    const clientId = doc.id;
    checked += 1;

    const hasToday = await (async () => {
      const q = await db
        .collection("client_measurements")
        .where("clientId", "==", clientId)
        .where("date", ">=", start)
        .where("date", "<", end)
        .limit(10)
        .get();
      return q.docs.some((m) => {
        const bw = m.data().bodyWeight;
        return typeof bw === "number" && !Number.isNaN(bw);
      });
    })();

    if (hasToday) {
      skippedLogged += 1;
      continue;
    }

    const userId = (doc.data() as { authUid?: string }).authUid ?? (await getClientAuthUid(db, clientId));
    if (!userId) continue;

    await db.collection("notifications").add({
      userId,
      type: "weight_daily_reminder",
      title,
      message,
      actionUrl: "/client/profile#body-weight",
      metadata: { clientId, perthDate, anchor: "body-weight" },
      isRead: false,
      createdAt: now,
    });
    reminded += 1;

    try {
      const result = await sendPushToUser({
        userId,
        title,
        body: message,
        actionPath: ACTION_PATH,
        tag: "weight_daily_reminder",
      });
      pushSent += result.sent;
    } catch {
      // in-app still created
    }
  }

  return { ok: true, perthDate, checked, reminded, skippedLogged, pushSent };
}
