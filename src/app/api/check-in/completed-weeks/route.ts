import { NextResponse } from "next/server";
import { requireClient } from "@/lib/api-auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { isAdminConfigured } from "@/lib/firebase-admin";

// Returns reflectionWeekStarts for this client+form: completed (submitted) and inProgress (assignment exists but not submitted).
// Ensures client cannot start a second check-in for the same week.
export async function GET(request: Request) {
  const authResult = await requireClient(request);
  if ("error" in authResult) return authResult.error;
  const clientId = authResult.identity.clientId!;
  const { searchParams } = new URL(request.url);
  const formId = searchParams.get("formId");

  if (!formId) {
    return NextResponse.json({ error: "formId required" }, { status: 400 });
  }

  if (!isAdminConfigured()) {
    return NextResponse.json({ completed: [], inProgress: [] });
  }

  const db = getAdminDb();
  const snap = await db
    .collection("check_in_assignments")
    .where("clientId", "==", clientId)
    .where("formId", "==", formId)
    .get();

  const completed: string[] = [];
  const inProgress: string[] = [];
  for (const d of snap.docs) {
    const data = d.data();
    const week = data.reflectionWeekStart as string;
    if (!week) continue;
    if (data.responseId && data.status === "completed") {
      completed.push(week);
    } else {
      inProgress.push(week);
    }
  }
  return NextResponse.json({
    completed: [...new Set(completed)],
    inProgress: [...new Set(inProgress)],
  });
}
