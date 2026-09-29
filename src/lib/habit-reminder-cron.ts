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
const STEPS_ACTION_PATH = "/client/habits?focus=steps";
const HABIT_IDS = HABIT_DEFINITIONS.map((h) => h.id);

const STEPS_REMINDER = {
  title: "Track your 10,000 steps",
  message: "How did your steps go today? Tap to log them in your Habit Tracker.",
  actionPath: STEPS_ACTION_PATH,
};

const REMAINING_HABITS_REMINDER = {
  title: "Finish today’s habits",
  message: "Steps are in — tap to add today’s water and sleep.",
  actionPath: ACTION_PATH,
};

/**
 * 19:00 Australia/Perth daily: remind clients to track steps (push + in-app),
 * or to finish their other habits if steps are already logged. Skips anyone done for the day.
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

      const { title, message, actionPath } = loggedIds.has("steps")
        ? REMAINING_HABITS_REMINDER
        : STEPS_REMINDER;

      await db.collection("notifications").add({
        userId,
        type: "habit_evening_reminder",
        title,
        message,
        actionUrl: actionPath,
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
          actionPath,
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
