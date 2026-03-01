import { NextResponse } from "next/server";
import { requireCoach } from "@/lib/api-auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { isAdminConfigured } from "@/lib/firebase-admin";

// GET: list standard (template) forms that coach can copy.
export async function GET(request: Request) {
  const authResult = await requireCoach(request);
  if ("error" in authResult) return authResult.error;

  if (!isAdminConfigured()) {
    return NextResponse.json([
      { id: "std-1", title: "Weekly check-in", description: "Standard template", category: "wellness", questions: [] },
    ]);
  }

  const db = getAdminDb();
  const snap = await db
    .collection("forms")
    .where("isStandard", "==", true)
    .limit(50)
    .get();
  const list = snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      title: data.title ?? "",
      description: data.description ?? "",
      category: data.category ?? "",
      questions: Array.isArray(data.questions) ? data.questions : [],
    };
  });
  return NextResponse.json(list);
}
