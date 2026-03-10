import { NextResponse } from "next/server";
import { requireCoach } from "@/lib/api-auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { isAdminConfigured } from "@/lib/firebase-admin";

const RECURRING_WEEKS = 52;

/** Given a Monday YYYY-MM-DD, return the next N Mondays (including start). */
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

// POST: create check-in assignment(s) for this client. recurring=true → create for next 52 weeks.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const authResult = await requireCoach(request);
  if ("error" in authResult) return authResult.error;
  const coachId = authResult.identity.coachId!;
  const { clientId } = await params;

  let body: { formId: string; reflectionWeekStart: string; recurring?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { formId, reflectionWeekStart, recurring } = body;
  if (!formId || !reflectionWeekStart) {
    return NextResponse.json(
      { error: "formId and reflectionWeekStart required" },
      { status: 400 }
    );
  }

  if (!isAdminConfigured()) {
    return NextResponse.json(
      recurring ? { assignmentIds: ["mock-1"], created: 1 } : { assignmentId: "mock-assignment-1" }
    );
  }

  const db = getAdminDb();
  const clientSnap = await db.collection("clients").doc(clientId).get();
  if (!clientSnap.exists) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }
  if ((clientSnap.data() as { coachId?: string }).coachId !== coachId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const formSnap = await db.collection("forms").doc(formId).get();
  const formTitle = formSnap.exists ? (formSnap.data()?.title as string) ?? "Check-in" : "Check-in";

  if (recurring) {
    const weekStarts = getWeekStarts(reflectionWeekStart, RECURRING_WEEKS);
    const existingSnap = await db
      .collection("check_in_assignments")
      .where("clientId", "==", clientId)
      .where("formId", "==", formId)
      .get();
    const existingWeeks = new Set(
      existingSnap.docs.map((d) => (d.data() as { reflectionWeekStart?: string }).reflectionWeekStart).filter(Boolean)
    );
    const toCreate = weekStarts.filter((w) => !existingWeeks.has(w));
    const assignmentIds: string[] = [];
    const now = new Date();
    for (const week of toCreate) {
      const dueDate = new Date(week + "T12:00:00Z");
      dueDate.setUTCDate(dueDate.getUTCDate() + 4);
      const ref = await db.collection("check_in_assignments").add({
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
      assignmentIds.push(ref.id);
    }
    return NextResponse.json({
      assignmentIds,
      created: assignmentIds.length,
      skipped: toCreate.length === 0 ? weekStarts.length : weekStarts.length - toCreate.length,
    });
  }

  const existing = await db
    .collection("check_in_assignments")
    .where("clientId", "==", clientId)
    .where("formId", "==", formId)
    .where("reflectionWeekStart", "==", reflectionWeekStart)
    .limit(1)
    .get();

  if (!existing.empty) {
    return NextResponse.json({ assignmentId: existing.docs[0].id });
  }

  const dueDate = new Date(reflectionWeekStart + "T12:00:00Z");
  dueDate.setUTCDate(dueDate.getUTCDate() + 4);
  const assignedAt = new Date();

  const ref = await db.collection("check_in_assignments").add({
    formId,
    formTitle,
    clientId,
    coachId,
    assignedAt,
    dueDate,
    reflectionWeekStart,
    status: "pending",
    responseId: null,
    createdAt: assignedAt,
    updatedAt: assignedAt,
  });

  return NextResponse.json({ assignmentId: ref.id });
}
