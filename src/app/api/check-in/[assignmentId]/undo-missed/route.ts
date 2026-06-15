import { NextResponse } from "next/server";
import { requireClient } from "@/lib/api-auth";
import { assignmentBelongsToClient } from "@/lib/client-assignment-ownership";
import { statusAfterUndoSkipped } from "@/lib/check-in-assignment-status";
import { getAdminDb } from "@/lib/firebase-admin";
import { isAdminConfigured } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

/** POST: client undoes marking a check-in as missed — returns it to their to-do list. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ assignmentId: string }> }
) {
  const authResult = await requireClient(request);
  if ("error" in authResult) return authResult.error;
  const { identity } = authResult;
  const { assignmentId } = await params;

  if (!isAdminConfigured()) {
    return NextResponse.json({ ok: true, status: "pending" });
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
    if (status !== "skipped") {
      return NextResponse.json(
        { error: "This check-in is not marked as missed." },
        { status: 400 }
      );
    }

    const restoredStatus = statusAfterUndoSkipped({
      statusBeforeSkipped: data.statusBeforeSkipped as string | undefined,
      dueDate: data.dueDate,
    });

    const now = new Date();
    await assignmentRef.update({
      status: restoredStatus,
      statusBeforeSkipped: FieldValue.delete(),
      skippedAt: FieldValue.delete(),
      updatedAt: now,
    });

    return NextResponse.json({ ok: true, status: restoredStatus });
  } catch (err) {
    console.error("[check-in/undo-missed]", assignmentId, err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to undo missed check-in" },
      { status: 500 }
    );
  }
}
