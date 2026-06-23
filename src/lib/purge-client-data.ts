import type { Firestore, Query } from "firebase-admin/firestore";
import { getAdminAuth } from "@/lib/firebase-admin";
import { CYCLE_DAILY_LOGS_COLLECTION, CYCLE_PROFILES_COLLECTION } from "@/lib/cycle-tracking";
import { HABIT_ENTRIES_COLLECTION } from "@/lib/habits-streaks";

const CLIENT_ACHIEVEMENTS_COLLECTION = "client_achievements";
const PENDING_ACHIEVEMENTS_COLLECTION = "pending_achievements";

async function deleteByQuery(db: Firestore, query: Query): Promise<number> {
  let total = 0;
  while (true) {
    const snap = await query.limit(400).get();
    if (snap.empty) break;
    const batch = db.batch();
    for (const doc of snap.docs) {
      batch.delete(doc.ref);
    }
    await batch.commit();
    total += snap.size;
  }
  return total;
}

async function deleteDocIfExists(db: Firestore, path: string): Promise<void> {
  const ref = db.doc(path);
  const snap = await ref.get();
  if (snap.exists) await ref.delete();
}

/**
 * Permanently remove a client's portal data and auth account.
 */
export async function purgeClientData(db: Firestore, clientId: string): Promise<void> {
  const clientSnap = await db.collection("clients").doc(clientId).get();
  if (!clientSnap.exists) return;

  const data = clientSnap.data() as {
    authUid?: string | null;
    email?: string;
    coachId?: string;
  };
  const coachId = typeof data.coachId === "string" ? data.coachId : "";
  const authUid = data.authUid ?? null;
  const email = typeof data.email === "string" ? data.email.trim().toLowerCase() : "";

  const responsesSnap = await db.collection("formResponses").where("clientId", "==", clientId).get();
  const responseIds = responsesSnap.docs.map((d) => d.id);

  if (responseIds.length > 0) {
    for (let i = 0; i < responseIds.length; i += 30) {
      const chunk = responseIds.slice(i, i + 30);
      await Promise.all(
        chunk.map((responseId) =>
          deleteByQuery(
            db,
            db.collection("coachFeedback").where("responseId", "==", responseId)
          )
        )
      );
    }
  }

  if (coachId) {
    await deleteByQuery(
      db,
      db.collection("messages").where("conversationId", "==", `${clientId}_${coachId}`)
    );
  }

  const userIds = new Set<string>();
  if (authUid) userIds.add(authUid);
  if (clientId) userIds.add(clientId);
  if (email) {
    const usersSnap = await db.collection("users").where("email", "==", email).limit(5).get();
    for (const doc of usersSnap.docs) userIds.add(doc.id);
  }

  await Promise.all([
    deleteByQuery(db, db.collection("check_in_assignments").where("clientId", "==", clientId)),
    deleteByQuery(db, db.collection("formResponses").where("clientId", "==", clientId)),
    deleteByQuery(db, db.collection("client_measurements").where("clientId", "==", clientId)),
    deleteByQuery(db, db.collection("progress_images").where("clientId", "==", clientId)),
    deleteByQuery(db, db.collection("clientGoals").where("clientId", "==", clientId)),
    deleteByQuery(db, db.collection(HABIT_ENTRIES_COLLECTION).where("clientId", "==", clientId)),
    deleteByQuery(db, db.collection(CYCLE_DAILY_LOGS_COLLECTION).where("clientId", "==", clientId)),
    deleteByQuery(db, db.collection(CLIENT_ACHIEVEMENTS_COLLECTION).where("clientId", "==", clientId)),
    deleteByQuery(db, db.collection(PENDING_ACHIEVEMENTS_COLLECTION).where("clientId", "==", clientId)),
    ...[...userIds].map((uid) =>
      deleteByQuery(db, db.collection("notifications").where("userId", "==", uid))
    ),
    ...[...userIds].map((uid) =>
      deleteByQuery(db, db.collection("pushTokens").where("userId", "==", uid))
    ),
  ]);

  await Promise.all([
    deleteDocIfExists(db, `clientScoring/${clientId}`),
    deleteDocIfExists(db, `client_programs/${clientId}`),
    deleteDocIfExists(db, `${CYCLE_PROFILES_COLLECTION}/${clientId}`),
  ]);

  for (const uid of userIds) {
    await deleteDocIfExists(db, `users/${uid}`);
    try {
      await getAdminAuth().deleteUser(uid);
    } catch {
      // user may already be removed
    }
  }

  await clientSnap.ref.delete();
}
