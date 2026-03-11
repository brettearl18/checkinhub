import { NextResponse } from "next/server";
import { requireClient } from "@/lib/api-auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { isAdminConfigured } from "@/lib/firebase-admin";

function toIso(v: unknown): string | null {
  if (!v) return null;
  if (typeof v === "string") return v;
  const t = v as { toDate?: () => Date };
  if (typeof t.toDate === "function") return t.toDate().toISOString();
  return null;
}

/** GET: my current program assignment (client). */
export async function GET(request: Request) {
  const authResult = await requireClient(request);
  if ("error" in authResult) return authResult.error;
  const clientId = authResult.identity.clientId!;

  if (!isAdminConfigured()) {
    return NextResponse.json(null);
  }

  const assignment = await getAdminDb().collection("client_programs").doc(clientId).get();
  if (!assignment.exists) {
    return NextResponse.json(null);
  }
  const data = assignment.data()!;
  if (data.status === "completed") {
    return NextResponse.json(null);
  }
  return NextResponse.json({
    programId: data.programId,
    programName: data.programName,
    programSnapshot: data.programSnapshot,
    startDate: typeof data.startDate === "string" ? data.startDate : toIso(data.startDate),
    currentWeek: typeof data.currentWeek === "number" ? data.currentWeek : 1,
    status: (data.status as string) ?? "active",
  });
}
