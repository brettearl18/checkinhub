import { NextResponse } from "next/server";
import { requireClient } from "@/lib/api-auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { isAdminConfigured } from "@/lib/firebase-admin";

const RESUMABLE_STATUSES = ["pending", "active", "overdue", "started"];

/** POST: mark all of the client's open assignments for weeks before the given Monday as missed (skipped). */
export async function POST(request: Request) {
  const authResult = await requireClient(request);
  if ("error" in authResult) return authResult.error;
  const { identity } = authResult;
  const clientId = identity.clientId!;
  const uid = identity.uid;

  let body: { beforeReflectionWeekStart: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { beforeReflectionWeekStart } = body;
  if (!beforeReflectionWeekStart || !/^\d{4}-\d{2}-\d{2}$/.test(beforeReflectionWeekStart)) {
    return NextResponse.json(
      { error: "beforeReflectionWeekStart required (YYYY-MM-DD Monday)" },
      { status: 400 }
    );
  }

  if (!isAdminConfigured()) {
    return NextResponse.json({ marked: 0 });
  }

  const db = getAdminDb();
  const idsToQuery = [clientId];
  if (uid && uid !== clientId) idsToQuery.push(uid);

  const allDocs: { id: string; reflectionWeekStart: string; status: string }[] = [];
  for (const id of idsToQuery) {
    const snap = await db
      .collection("check_in_assignments")
      .where("clientId", "==", id)
      .where("status", "in", RESUMABLE_STATUSES)
      .get();
    for (const d of snap.docs) {
      const data = d.data();
      const week = (data.reflectionWeekStart as string) ?? "";
      const status = (data.status as string) ?? "pending";
      allDocs.push({ id: d.id, reflectionWeekStart: week, status });
    }
  }

  const seen = new Set<string>();
  const toMark = allDocs.filter((doc) => {
    if (seen.has(doc.id)) return false;
    seen.add(doc.id);
    return doc.reflectionWeekStart < beforeReflectionWeekStart;
  });

  const now = new Date();
  for (const doc of toMark) {
    await db.collection("check_in_assignments").doc(doc.id).update({
      status: "skipped",
      updatedAt: now,
    });
  }

  return NextResponse.json({ marked: toMark.length });
}
