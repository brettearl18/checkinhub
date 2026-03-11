import { NextResponse } from "next/server";
import { requireCoach } from "@/lib/api-auth";
import { getAdminDb, getAdminAuth } from "@/lib/firebase-admin";
import { isAdminConfigured } from "@/lib/firebase-admin";

/**
 * GET .../check-ins/completed-list
 * Returns all completed check-in assignments for this client, from every ID we query
 * (client doc id, authUid, uid from email). For debugging / listing what's in the DB.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const authResult = await requireCoach(request);
  if ("error" in authResult) return authResult.error;
  const coachId = authResult.identity.coachId!;
  const { clientId } = await params;

  if (!isAdminConfigured()) {
    return NextResponse.json({ error: "Not available without Firebase" }, { status: 503 });
  }

  const db = getAdminDb();
  const clientSnap = await db.collection("clients").doc(clientId).get();
  if (!clientSnap.exists) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }
  const clientData = clientSnap.data() as { coachId?: string; authUid?: string; email?: string };
  if (clientData.coachId !== coachId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const idsToQuery: string[] = [clientId];
  const authUid = clientData.authUid ?? null;
  if (authUid && authUid !== clientId) idsToQuery.push(authUid);

  const email = (clientData.email ?? "").trim().toLowerCase();
  if (email) {
    const usersSnap = await db.collection("users").where("email", "==", email).limit(1).get();
    if (!usersSnap.empty) {
      const uid = usersSnap.docs[0].id;
      if (uid && uid !== clientId && !idsToQuery.includes(uid)) idsToQuery.push(uid);
    }
    try {
      const auth = getAdminAuth();
      const authUser = await auth.getUserByEmail(email);
      if (authUser?.uid && authUser.uid !== clientId && !idsToQuery.includes(authUser.uid)) {
        idsToQuery.push(authUser.uid);
      }
    } catch {
      // ignore
    }
  }

  const completed: Array<{
    id: string;
    clientId: string;
    formId: string;
    formTitle: string;
    status: string;
    dueDate: string | null;
    completedAt: string | null;
    reflectionWeekStart: string | null;
    responseId: string | null;
  }> = [];

  for (const cid of idsToQuery) {
    const snap = await db
      .collection("check_in_assignments")
      .where("clientId", "==", cid)
      .where("status", "==", "completed")
      .orderBy("dueDate", "desc")
      .get();

    for (const d of snap.docs) {
      const data = d.data();
      const toStr = (v: unknown): string | null => {
        if (v == null) return null;
        if (typeof v === "string") return v;
        const t = v as { toDate?: () => Date };
        if (typeof t.toDate === "function") return t.toDate().toISOString();
        return String(v);
      };
      completed.push({
        id: d.id,
        clientId: cid,
        formId: (data.formId as string) ?? "",
        formTitle: (data.formTitle as string) ?? "",
        status: (data.status as string) ?? "completed",
        dueDate: toStr(data.dueDate),
        completedAt: toStr(data.completedAt),
        reflectionWeekStart: toStr(data.reflectionWeekStart) ?? null,
        responseId: (data.responseId as string) ?? null,
      });
    }
  }

  // Sort by completedAt desc (most recent first)
  completed.sort((a, b) => {
    const ta = a.completedAt ? new Date(a.completedAt).getTime() : 0;
    const tb = b.completedAt ? new Date(b.completedAt).getTime() : 0;
    return tb - ta;
  });

  return NextResponse.json({
    clientId,
    idsQueried: idsToQuery,
    completedCount: completed.length,
    completed,
  });
}
