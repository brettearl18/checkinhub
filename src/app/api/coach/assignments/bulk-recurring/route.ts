import { NextResponse } from "next/server";
import { requireCoach } from "@/lib/api-auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { isAdminConfigured } from "@/lib/firebase-admin";

const RECURRING_WEEKS = 52;

function getWeekStarts(startMonday: string, count: number): string[] {
  const out: string[] = [];
  const d = new Date(startMonday + "T12:00:00Z");
  for (let i = 0; i < count; i++) {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    out.push(`${y}-${m}-${day}`);
    d.setUTCDate(d.getUTCDate() + 7);
  }
  return out;
}

/** POST: assign recurring check-in (52 weeks) to all of the coach's non-archived clients. */
export async function POST(request: Request) {
  const authResult = await requireCoach(request);
  if ("error" in authResult) return authResult.error;
  const coachId = authResult.identity.coachId!;

  let body: { formId: string; reflectionWeekStart: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { formId, reflectionWeekStart } = body;
  if (!formId || !reflectionWeekStart) {
    return NextResponse.json(
      { error: "formId and reflectionWeekStart required" },
      { status: 400 }
    );
  }

  if (!isAdminConfigured()) {
    return NextResponse.json({
      created: 0,
      clientsProcessed: 0,
      errors: [],
    });
  }

  const db = getAdminDb();
  const formSnap = await db.collection("forms").doc(formId).get();
  const formTitle = formSnap.exists ? (formSnap.data()?.title as string) ?? "Check-in" : "Check-in";

  const clientsSnap = await db
    .collection("clients")
    .where("coachId", "==", coachId)
    .get();
  const clientIds = clientsSnap.docs
    .map((d) => ({ id: d.id, data: d.data() }))
    .filter((c) => (c.data.status as string) !== "archived")
    .map((c) => c.id);

  const weekStarts = getWeekStarts(reflectionWeekStart, RECURRING_WEEKS);
  let totalCreated = 0;
  const errors: { clientId: string; error: string }[] = [];
  const now = new Date();

  for (const clientId of clientIds) {
    try {
      const existingSnap = await db
        .collection("check_in_assignments")
        .where("clientId", "==", clientId)
        .where("formId", "==", formId)
        .get();
      const existingWeeks = new Set(
        existingSnap.docs
          .map((d) => (d.data() as { reflectionWeekStart?: string }).reflectionWeekStart)
          .filter(Boolean)
      );
      const toCreate = weekStarts.filter((w) => !existingWeeks.has(w));
      for (const week of toCreate) {
        const dueDate = new Date(week + "T12:00:00Z");
        dueDate.setUTCDate(dueDate.getUTCDate() + 4);
        await db.collection("check_in_assignments").add({
          formId,
          formTitle,
          clientId,
          coachId,
          assignedAt: now,
          dueDate,
          reflectionWeekStart: week,
          status: "pending",
          responseId: null,
          createdAt: now,
          updatedAt: now,
        });
        totalCreated++;
      }
    } catch (err) {
      errors.push({
        clientId,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  return NextResponse.json({
    created: totalCreated,
    clientsProcessed: clientIds.length,
    errors,
  });
}
