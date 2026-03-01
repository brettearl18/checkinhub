import { NextResponse } from "next/server";
import { requireClient } from "@/lib/api-auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { isAdminConfigured } from "@/lib/firebase-admin";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ assignmentId: string }> }
) {
  const authResult = await requireClient(request);
  if ("error" in authResult) return authResult.error;
  const clientId = authResult.identity.clientId!;
  const { assignmentId } = await params;

  let body: { responses: Array<{ questionId: string; answer: string | number | string[]; notes?: string }> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { responses } = body;
  if (!Array.isArray(responses)) {
    return NextResponse.json({ error: "responses array required" }, { status: 400 });
  }

  if (!isAdminConfigured()) {
    return NextResponse.json({ success: true });
  }

  const db = getAdminDb();
  const assignmentRef = db.collection("check_in_assignments").doc(assignmentId);
  const assignmentSnap = await assignmentRef.get();
  if (!assignmentSnap.exists) {
    return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
  }
  const assignmentData = assignmentSnap.data()!;
  if (assignmentData.clientId !== clientId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (assignmentData.responseId) {
    return NextResponse.json({ error: "Check-in already submitted" }, { status: 400 });
  }

  const now = new Date();
  const update: Record<string, unknown> = {
    draftResponses: responses,
    draftUpdatedAt: now,
    updatedAt: now,
  };
  if (assignmentData.status === "pending") {
    update.status = "started";
  }

  await assignmentRef.update(update);
  return NextResponse.json({ success: true });
}
