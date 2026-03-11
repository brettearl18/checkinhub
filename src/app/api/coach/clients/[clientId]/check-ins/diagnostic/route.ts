import { NextResponse } from "next/server";
import { requireCoach } from "@/lib/api-auth";
import { getAdminDb, getAdminAuth } from "@/lib/firebase-admin";
import { isAdminConfigured } from "@/lib/firebase-admin";

/**
 * GET .../check-ins/diagnostic
 * Returns why check-ins might be missing for this client: client doc fields, IDs we query,
 * assignment counts per ID, and suggested fix (e.g. set authUid).
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
  const clientData = clientSnap.data() as { coachId?: string; authUid?: string; email?: string; firstName?: string; lastName?: string };
  if (clientData.coachId !== coachId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const authUid = clientData.authUid ?? null;
  const email = (clientData.email ?? "").trim().toLowerCase();
  const idsToQuery: string[] = [clientId];
  if (authUid && authUid !== clientId) idsToQuery.push(authUid);

  let uidFromUsers: string | null = null;
  if (email) {
    const usersSnap = await db.collection("users").where("email", "==", email).limit(1).get();
    if (!usersSnap.empty) {
      uidFromUsers = usersSnap.docs[0].id;
      if (uidFromUsers && uidFromUsers !== clientId && !idsToQuery.includes(uidFromUsers)) {
        idsToQuery.push(uidFromUsers);
      }
    }
  }

  let uidFromAuth: string | null = null;
  if (email) {
    try {
      const auth = getAdminAuth();
      const authUser = await auth.getUserByEmail(email);
      if (authUser?.uid) {
        uidFromAuth = authUser.uid;
        if (uidFromAuth !== clientId && !idsToQuery.includes(uidFromAuth)) {
          idsToQuery.push(uidFromAuth);
        }
      }
    } catch {
      // email not in Auth or error
    }
  }

  const assignmentCountByClientId: Record<string, number> = {};
  const assignmentSamplesByClientId: Record<string, Array<{ id: string; status: string; formTitle: string; completedAt: string | null }>> = {};
  for (const id of idsToQuery) {
    const snap = await db
      .collection("check_in_assignments")
      .where("clientId", "==", id)
      .orderBy("dueDate", "desc")
      .limit(50)
      .get();
    assignmentCountByClientId[id] = snap.size;
    assignmentSamplesByClientId[id] = snap.docs.slice(0, 5).map((d) => {
      const data = d.data();
      const completed = data.completedAt;
      let completedAt: string | null = null;
      if (completed) {
        if (typeof (completed as { toDate?: () => Date }).toDate === "function") {
          completedAt = (completed as { toDate: () => Date }).toDate().toISOString();
        } else completedAt = String(completed);
      }
      return {
        id: d.id,
        status: (data.status as string) ?? "pending",
        formTitle: (data.formTitle as string) ?? "",
        completedAt,
      };
    });
  }

  const totalAssignments = Object.values(assignmentCountByClientId).reduce((a, b) => a + b, 0);
  const completedUnderOtherId =
    idsToQuery.length > 1 &&
    idsToQuery.some((id) => id !== clientId && assignmentCountByClientId[id] > 0);

  let suggestion: string | null = null;
  if (totalAssignments === 0) {
    suggestion = "No check-in assignments found under any of the queried IDs. Client may not have started or completed any check-ins yet.";
  } else if (completedUnderOtherId && !authUid && (uidFromUsers || uidFromAuth)) {
    const uid = uidFromAuth ?? uidFromUsers;
    suggestion = `Check-ins exist under Firebase UID (${uid}). Set authUid on the client doc to this value so the profile shows them. Use POST .../check-ins/repair to fix.`;
  } else if (totalAssignments > 0) {
    suggestion = "Check-ins are being found. If the coach profile still does not show them, refresh the page or check the browser console for errors.";
  }

  return NextResponse.json({
    clientId,
    clientDoc: {
      authUid: authUid ?? null,
      email: clientData.email ?? null,
    },
    uidFromUsers: uidFromUsers ?? null,
    uidFromAuth: uidFromAuth ?? null,
    idsQueried: idsToQuery,
    assignmentCountByClientId,
    assignmentSamplesByClientId,
    totalAssignments,
    suggestion,
  });
}
