import { NextResponse } from "next/server";
import { requireCoach } from "@/lib/api-auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { isAdminConfigured } from "@/lib/firebase-admin";

// Real assignments only; sorted by date (completedAt when completed, else dueDate).
export async function GET(
  request: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const authResult = await requireCoach(request);
  if ("error" in authResult) return authResult.error;
  const coachId = authResult.identity.coachId!;
  const { clientId } = await params;

  if (!isAdminConfigured()) {
    return NextResponse.json([
      {
        id: "mock-1",
        formId: "form-1",
        formTitle: "Weekly check-in",
        status: "completed",
        dueDate: "2026-02-28T00:00:00.000Z",
        completedAt: "2026-02-28T12:00:00.000Z",
        reflectionWeekStart: "2026-02-24",
      },
    ]);
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

  // Assignments may be stored with client doc id OR auth UID (legacy); query all possible ids and merge.
  const idsToQuery = [clientId];
  const authUid = clientData.authUid;
  if (authUid && authUid !== clientId) idsToQuery.push(authUid);
  // Fallback: find auth UID by client email (users collection doc id = uid) when authUid not on client doc.
  if (!authUid || authUid === clientId) {
    const email = clientData.email;
    if (email) {
      const usersSnap = await db.collection("users").where("email", "==", email).limit(1).get();
      if (!usersSnap.empty) {
        const uid = usersSnap.docs[0].id;
        if (uid && uid !== clientId && !idsToQuery.includes(uid)) idsToQuery.push(uid);
      }
    }
  }

  try {
    const allDocs: { id: string; data: () => Record<string, unknown> }[] = [];
    for (const id of idsToQuery) {
      const snap = await db
        .collection("check_in_assignments")
        .where("clientId", "==", id)
        .orderBy("dueDate", "desc")
        .get();
      for (const d of snap.docs) {
        allDocs.push({ id: d.id, data: () => d.data() ?? {} });
      }
    }
    const seen = new Set<string>();
    const unique = allDocs.filter((d) => {
      if (seen.has(d.id)) return false;
      seen.add(d.id);
      return true;
    });
    const toTime = (due: unknown): number => {
      if (!due) return 0;
      if (due instanceof Date) return due.getTime();
      const d = due as { toDate?: () => Date };
      if (typeof d.toDate === "function") return d.toDate().getTime();
      return new Date(String(due)).getTime();
    };
    unique.sort((a, b) => {
      const dataA = a.data();
      const dataB = b.data();
      const dueA = dataA.dueDate && typeof (dataA.dueDate as { toDate?: () => Date }).toDate === "function" ? (dataA.dueDate as { toDate: () => Date }).toDate() : dataA.dueDate;
      const dueB = dataB.dueDate && typeof (dataB.dueDate as { toDate?: () => Date }).toDate === "function" ? (dataB.dueDate as { toDate: () => Date }).toDate() : dataB.dueDate;
      return toTime(dueB) - toTime(dueA);
    });

    const toDate = (v: unknown): Date | null => {
      if (!v) return null;
      if (v instanceof Date) return v;
      const t = v as { toDate?: () => Date };
      if (typeof t.toDate === "function") return t.toDate();
      return new Date(String(v));
    };
    const list = unique.map((d) => {
      const data = d.data();
      const due = toDate(data.dueDate);
      const completed = toDate(data.completedAt);
      return {
        id: d.id,
        formId: data.formId,
        formTitle: data.formTitle ?? "",
        status: data.status ?? "pending",
        dueDate: due ? due.toISOString() : null,
        completedAt: completed ? completed.toISOString() : null,
        reflectionWeekStart: data.reflectionWeekStart ?? null,
        responseId: data.responseId ?? null,
      };
    });
    return NextResponse.json(list);
  } catch (err) {
    console.error("[coach/clients/check-ins]", err);
    return NextResponse.json(
      { error: "Failed to load check-ins" },
      { status: 500 }
    );
  }
}
