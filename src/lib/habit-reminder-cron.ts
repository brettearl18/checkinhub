import { getAdminDb, isAdminConfigured } from "@/lib/firebase-admin";
import { sendPushToUser } from "@/lib/push-server";
import { todayPerth } from "@/lib/perth-date";
import { isClosedClientStatus } from "@/lib/client-status";
import { HABIT_DEFINITIONS } from "@/lib/habits";
import { HABIT_ENTRIES_COLLECTION } from "@/lib/habits-streaks";

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

const ACTION_PATH = "/client/habits";
const HABIT_IDS = HABIT_DEFINITIONS.map((h) => h.id);

/**
 * 19:00 Australia/Perth daily: remind clients to log habits (push + in-app)
 * if they have not logged all habits for today.
 * Cron: 0 11 * * * (UTC) → 19:00 Perth.
 */
export async function runHabitRemindersPerth(): Promise<{
  ok: true;
  perthDate: string;
  checked: number;
  reminded: number;
  skippedComplete: number;
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
      skippedComplete: 0,
      skippedClosed: 0,
      pushSent: 0,
      errors: 0,
    };
  }

  const db = getAdminDb();
  const perthDate = todayPerth();
  const now = new Date();

  const title = "Log your habits";
  const message = "Evening check-in — log steps, hydration, and sleep in your Habit Tracker.";

  const clientsSnap = await db.collection("clients").get();
  let checked = 0;
  let reminded = 0;
  let skippedComplete = 0;
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

      const entriesSnap = await db
        .collection(HABIT_ENTRIES_COLLECTION)
        .where("clientId", "==", clientId)
        .where("date", "==", perthDate)
        .limit(20)
        .get();

      const loggedIds = new Set<string>();
      for (const entry of entriesSnap.docs) {
        const habitId = (entry.data() as { habitId?: string }).habitId;
        if (habitId) loggedIds.add(habitId);
      }
      const allLogged = HABIT_IDS.every((id) => loggedIds.has(id));
      if (allLogged) {
        skippedComplete += 1;
        continue;
      }

      const userId = await getClientAuthUid(db, clientId, data);
      if (!userId) continue;

      await db.collection("notifications").add({
        userId,
        type: "habit_evening_reminder",
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
          tag: "habit_evening_reminder",
        });
        pushSent += result.sent;
      } catch {
        // in-app still created
      }
    } catch {
      errors += 1;
    }
  }

  return {
    ok: true,
    perthDate,
    checked,
    reminded,
    skippedComplete,
    skippedClosed,
    pushSent,
    errors,
  };
}
