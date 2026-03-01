import { NextResponse } from "next/server";
import { requireClient } from "@/lib/api-auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { isAdminConfigured } from "@/lib/firebase-admin";

export async function GET(request: Request) {
  const authResult = await requireClient(request);
  if ("error" in authResult) return authResult.error;

  if (!isAdminConfigured()) {
    return NextResponse.json([
      { id: "form-1", title: "Weekly check-in", description: "Standard weekly reflection", category: "wellness" },
      { id: "form-2", title: "Progress check", description: "Monthly progress review", category: "progress" },
    ]);
  }

  const db = getAdminDb();
  const formsSnap = await db
    .collection("forms")
    .where("isActive", "==", true)
    .get();
  const forms = formsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  return NextResponse.json(forms);
}
