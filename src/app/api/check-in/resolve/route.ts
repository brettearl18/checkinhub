import { NextResponse } from "next/server";
import { requireClient } from "@/lib/api-auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { isAdminConfigured } from "@/lib/firebase-admin";

// reflectionWeekStart = Monday YYYY-MM-DD
function nextMondayAfter(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? 1 : day === 1 ? 0 : 8 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

export async function POST(request: Request) {
  const authResult = await requireClient(request);
  if ("error" in authResult) return authResult.error;
  const { identity } = authResult;

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

  const clientId = identity.clientId!;

  if (!isAdminConfigured()) {
    const mockId = `mock-assignment-${formId}-${reflectionWeekStart}`;
    return NextResponse.json({ assignmentId: mockId });
  }

  const db = getAdminDb();

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

  const formSnap = await db.collection("forms").doc(formId).get();
  const formTitle = formSnap.exists ? (formSnap.data()?.title as string) ?? "Check-in" : "Check-in";
  const clientSnap = await db.collection("clients").doc(clientId).get();
  const coachId = (clientSnap.data()?.coachId as string) ?? null;

  const dueDate = new Date(reflectionWeekStart);
  dueDate.setDate(dueDate.getDate() + 4);
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
