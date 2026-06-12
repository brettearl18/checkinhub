import type { Firestore } from "firebase-admin/firestore";
import type { ResolvedIdentity } from "@/lib/api-auth";

/** All client document ids / auth uids that may own check-in assignments for this user. */
export async function resolveClientOwnerIds(
  db: Firestore,
  identity: ResolvedIdentity
): Promise<Set<string>> {
  const ids = new Set<string>();
  if (identity.clientId) ids.add(identity.clientId);
  if (identity.uid) ids.add(identity.uid);

  if (identity.clientId) {
    const snap = await db.collection("clients").doc(identity.clientId).get();
    const authUid = snap.data()?.authUid;
    if (typeof authUid === "string" && authUid.trim()) ids.add(authUid.trim());
  }

  if (identity.uid) {
    const byAuthUid = await db
      .collection("clients")
      .where("authUid", "==", identity.uid)
      .limit(10)
      .get();
    for (const doc of byAuthUid.docs) ids.add(doc.id);
  }

  return ids;
}

export async function assignmentBelongsToClient(
  db: Firestore,
  assignmentClientId: string,
  identity: ResolvedIdentity
): Promise<boolean> {
  if (!assignmentClientId) return false;
  const ownerIds = await resolveClientOwnerIds(db, identity);
  return ownerIds.has(assignmentClientId);
}
