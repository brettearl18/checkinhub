import { NextResponse } from "next/server";
import { requireClient } from "@/lib/api-auth";
import { assignmentBelongsToClient } from "@/lib/client-assignment-ownership";
import { getAdminDb } from "@/lib/firebase-admin";
import { isAdminConfigured } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

/** POST: client marks this assignment as missed (skipped). Removes it from their to-do list and stops it counting as overdue. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ assignmentId: string }> }
) {
  const authResult = await requireClient(request);
  if ("error" in authResult) return authResult.error;
  const { identity } = authResult;
  const { assignmentId } = await params;

  if (!isAdminConfigured()) {
    return NextResponse.json({ ok: true });
  }

  try {
    const db = getAdminDb();
    const assignmentRef = db.collection("check_in_assignments").doc(assignmentId);
    const assignmentSnap = await assignmentRef.get();
    if (!assignmentSnap.exists) {
      return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
    }
    const data = assignmentSnap.data()!;
    const assignClientId = (data.clientId as string) ?? "";

    const owns = await assignmentBelongsToClient(db, assignClientId, identity);
    if (!owns) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const status = (data.status as string) ?? "pending";
    if (status === "completed") {
      return NextResponse.json(
        { error: "This check-in is already completed." },
        { status: 400 }
      );
    }
    if (status === "skipped") {
      return NextResponse.json({ ok: true });
    }

    const now = new Date();
    await assignmentRef.update({
      status: "skipped",
      draftResponses: FieldValue.delete(),
      draftUpdatedAt: FieldValue.delete(),
      updatedAt: now,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[check-in/mark-missed]", assignmentId, err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to mark as missed" },
      { status: 500 }
    );
  }
}
