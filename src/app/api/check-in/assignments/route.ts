import { NextResponse } from "next/server";
import { requireClient } from "@/lib/api-auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { isAdminConfigured } from "@/lib/firebase-admin";

function toDate(v: unknown): Date | null {
  if (!v) return null;
  if (v instanceof Date) return v;
  const t = v as { toDate?: () => Date };
  if (typeof t.toDate === "function") return t.toDate();
  try {
    return new Date(String(v));
  } catch {
    return null;
  }
}

// Resumable = pending, active, overdue, started. Queries by both client doc id and auth uid.
export async function GET(request: Request) {
  const authResult = await requireClient(request);
  if ("error" in authResult) return authResult.error;
  const { identity } = authResult;
  const clientId = identity.clientId!;
  const uid = identity.uid;

  if (!isAdminConfigured()) {
    return NextResponse.json([
      {
        id: "mock-assignment-1",
        formId: "form-1",
        formTitle: "Weekly check-in",
        reflectionWeekStart: "2026-02-24",
        status: "pending",
        dueDate: "2026-02-28T00:00:00.000Z",
      },
    ]);
  }

  const idsToQuery = [clientId];
  if (uid && uid !== clientId) idsToQuery.push(uid);

  try {
    const db = getAdminDb();
    const allDocs: { id: string; data: () => Record<string, unknown> }[] = [];
    for (const id of idsToQuery) {
      const snap = await db
        .collection("check_in_assignments")
        .where("clientId", "==", id)
        .where("status", "in", ["pending", "active", "overdue", "started"])
        .orderBy("dueDate", "asc")
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
    const withDue = unique.map((d) => {
      const data = d.data();
      const due = toDate(data.dueDate);
      return { id: d.id, data: d.data, dueTime: due ? due.getTime() : 0 };
    });
    withDue.sort((a, b) => a.dueTime - b.dueTime);
    const assignments = withDue.map(({ id, data }) => {
      const d = data();
      const due = toDate(d.dueDate);
      return {
        id,
        formId: d.formId,
        formTitle: d.formTitle,
        reflectionWeekStart: d.reflectionWeekStart,
        status: d.status,
        dueDate: due ? due.toISOString() : null,
      };
    });
    return NextResponse.json(assignments);
  } catch (err) {
    console.error("[check-in/assignments]", err);
    const message =
      err instanceof Error && /index|indexes/i.test(err.message)
        ? "Assignments query needs a Firestore index. Deploy firestore.indexes.json or create the index in Firebase Console."
        : "Failed to load assignments";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
