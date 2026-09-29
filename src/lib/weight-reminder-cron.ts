import { getAdminDb, isAdminConfigured } from "@/lib/firebase-admin";
import { sendPushToUser } from "@/lib/push-server";
import { measurementDateKeyFromFirestore } from "@/lib/client-measurements-server";
import { todayPerth } from "@/lib/perth-date";
import { isClosedClientStatus } from "@/lib/client-status";

async function getClientAuthUid(
  db: ReturnType<typeof getAdminDb>,
  clientId: string,
  data: { authUid?: string; email?: string }
): Promise<string | null> {
  if (data.authUid) return data.authUid;
  if (data.email) {
    const usersSnap = await db.collection("users").where("email", "==", data.email).limit(1).get();
    if (!usersSnap.empty) return usersSnap.docs[0].id;
  }
  return clientId;
}

const ACTION_PATH = "/client?log=weight";

/**
 * 7:00 Australia/Perth daily: remind clients to log body weight (push + in-app), if not yet today.
 * Cron: 0 23 * * * (UTC) → 07:00 Perth.
 */
export async function runWeightRemindersPerth(): Promise<{
  ok: true;
  perthDate: string;
  checked: number;
  reminded: number;
  skippedLogged: number;
  skippedClosed: number;
  pushSent: number;
  errors: number;
}> {
  if (!isAdminConfigured()) {
    return {
      ok: true,
      perthDate: todayPerth(),
      checked: 0,
      reminded: 0,
      skippedLogged: 0,
      skippedClosed: 0,
      pushSent: 0,
      errors: 0,
    };
  }

  const db = getAdminDb();
  const perthDate = todayPerth();
  const now = new Date();

  const title = "Log your body weight";
  const message = "Morning weigh-in — tap to log today’s weight in a few seconds.";

  const clientsSnap = await db.collection("clients").get();
  let checked = 0;
  let reminded = 0;
  let skippedLogged = 0;
  let skippedClosed = 0;
  let pushSent = 0;
  let errors = 0;

  for (const doc of clientsSnap.docs) {
    const clientId = doc.id;
    const data = doc.data() as { authUid?: string; email?: string; status?: string };
    checked += 1;

    try {
      if (isClosedClientStatus(data.status)) {
        skippedClosed += 1;
        continue;
      }

      const measSnap = await db
        .collection("client_measurements")
        .where("clientId", "==", clientId)
        .orderBy("date", "desc")
        .limit(30)
        .get();

      const hasToday = measSnap.docs.some((m) => {
        const key = measurementDateKeyFromFirestore(m.data().date);
        const bw = m.data().bodyWeight;
        return key === perthDate && typeof bw === "number" && !Number.isNaN(bw);
      });

      if (hasToday) {
        skippedLogged += 1;
        continue;
      }

      const userId = await getClientAuthUid(db, clientId, data);
      if (!userId) continue;

      await db.collection("notifications").add({
        userId,
        type: "weight_daily_reminder",
        title,
        message,
        actionUrl: ACTION_PATH,
        metadata: { clientId, perthDate },
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
    } catch {
      errors += 1;
    }
  }

  return { ok: true, perthDate, checked, reminded, skippedLogged, skippedClosed, pushSent, errors };
}
