import { NextResponse } from "next/server";
import { requireCoach } from "@/lib/api-auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { isAdminConfigured } from "@/lib/firebase-admin";

// POST: create a check-in assignment for this client (form + reflection week). Coach must own the client.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const authResult = await requireCoach(request);
  if ("error" in authResult) return authResult.error;
  const coachId = authResult.identity.coachId!;
  const { clientId } = await params;

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
    return NextResponse.json({ assignmentId: "mock-assignment-1" });
  }

  const db = getAdminDb();
  const clientSnap = await db.collection("clients").doc(clientId).get();
  if (!clientSnap.exists) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }
  if ((clientSnap.data() as { coachId?: string }).coachId !== coachId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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

  const formSnap = await db.collection("forms").doc(formId).get();
  const formTitle = formSnap.exists ? (formSnap.data()?.title as string) ?? "Check-in" : "Check-in";

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
