import { NextResponse } from "next/server";
import { requireClient } from "@/lib/api-auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { isAdminConfigured } from "@/lib/firebase-admin";

/** POST: client marks this assignment as missed (skipped). Removes it from their to-do list and stops it counting as overdue. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ assignmentId: string }> }
) {
  const authResult = await requireClient(request);
  if ("error" in authResult) return authResult.error;
  const { identity } = authResult;
  const clientId = identity.clientId!;
  const uid = identity.uid;
  const { assignmentId } = await params;

  if (!isAdminConfigured()) {
    return NextResponse.json({ ok: true });
  }

  const db = getAdminDb();
  const assignmentRef = db.collection("check_in_assignments").doc(assignmentId);
  const assignmentSnap = await assignmentRef.get();
  if (!assignmentSnap.exists) {
    return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
  }
  const data = assignmentSnap.data()!;
  const assignClientId = data.clientId as string;
  const owns =
    assignClientId === clientId || (uid != null && assignClientId === uid);
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
    updatedAt: now,
  });

  return NextResponse.json({ ok: true });
}
