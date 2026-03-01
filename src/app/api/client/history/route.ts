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

// Completed check-ins only; sorted by completedAt desc. Queries by both client doc id and auth uid.
export async function GET(request: Request) {
  const authResult = await requireClient(request);
  if ("error" in authResult) return authResult.error;
  const clientId = authResult.identity.clientId!;
  const uid = authResult.identity.uid;

  if (!isAdminConfigured()) {
    return NextResponse.json([]);
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
        .where("status", "==", "completed")
        .orderBy("completedAt", "desc")
        .limit(50)
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
    const withTime = unique.map((d) => {
      const data = d.data();
      const completedAt = toDate(data.completedAt);
      return { ...d, completedAt, completedTime: completedAt ? completedAt.getTime() : 0 };
    });
    withTime.sort((a, b) => b.completedTime - a.completedTime);
    const list = withTime.slice(0, 50).map(({ id, data }) => {
      const d = data();
      const completedAt = toDate(d.completedAt);
      const dueDate = toDate(d.dueDate);
      return {
        id,
        formId: d.formId,
        formTitle: d.formTitle ?? "Check-in",
        reflectionWeekStart: d.reflectionWeekStart,
        completedAt: completedAt ? completedAt.toISOString() : null,
        dueDate: dueDate ? dueDate.toISOString() : null,
        score: d.score ?? null,
        responseId: d.responseId ?? null,
      };
    });
    return NextResponse.json(list);
  } catch (err) {
    console.error("[client/history]", err);
    return NextResponse.json(
      { error: "Failed to load history" },
      { status: 500 }
    );
  }
}
