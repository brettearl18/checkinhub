import { NextResponse } from "next/server";
import { requireClient } from "@/lib/api-auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { isAdminConfigured } from "@/lib/firebase-admin";

// Returns set of reflectionWeekStart (Monday YYYY-MM-DD) that have a completed assignment for this client+form.
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
    return NextResponse.json([]);
  }

  const db = getAdminDb();
  const snap = await db
    .collection("check_in_assignments")
    .where("clientId", "==", clientId)
    .where("formId", "==", formId)
    .where("status", "==", "completed")
    .get();

  const weeks = snap.docs.map((d) => d.data().reflectionWeekStart as string).filter(Boolean);
  return NextResponse.json([...new Set(weeks)]);
}
