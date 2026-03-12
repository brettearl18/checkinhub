import { NextResponse } from "next/server";
import { requireClient } from "@/lib/api-auth";
import { getAdminDb, isAdminConfigured } from "@/lib/firebase-admin";

function toDate(v: unknown): Date | null {
  if (!v) return null;
  if (v instanceof Date) return v;
  const t = v as { toDate?: () => Date };
  if (typeof t.toDate === "function") return t.toDate();
  try {
    return new Date(String(v));
  } catch {
    return null;
  }
}

/** Monday YYYY-MM-DD for the week containing the given date. */
function mondayOfWeek(d: Date): string {
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  const mon = new Date(d);
  mon.setUTCDate(d.getUTCDate() + diff);
  return mon.toISOString().slice(0, 10);
}

/**
 * GET /api/client/check-in-start-week
 * Returns the Monday (YYYY-MM-DD) of the first week the client can fill in.
 * Clients cannot view or select weeks before they started (client createdAt, or programStartDate if set).
 */
export async function GET(request: Request) {
  const authResult = await requireClient(request);
  if ("error" in authResult) return authResult.error;
  const clientId = authResult.identity.clientId!;

  if (!isAdminConfigured()) {
    return NextResponse.json({ startWeek: "2000-01-01" }); // no restriction in mock
  }

  const db = getAdminDb();
  const clientSnap = await db.collection("clients").doc(clientId).get();
  if (!clientSnap.exists) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const data = clientSnap.data() as { createdAt?: unknown; programStartDate?: string };
  const createdAt = toDate(data.createdAt);
  const programStart = data.programStartDate && /^\d{4}-\d{2}-\d{2}/.test(data.programStartDate)
    ? new Date(data.programStartDate + "T12:00:00Z")
    : null;

  let startDate: Date;
  if (createdAt && programStart) {
    startDate = createdAt.getTime() > programStart.getTime() ? createdAt : programStart;
  } else if (programStart) {
    startDate = programStart;
  } else if (createdAt) {
    startDate = createdAt;
  } else {
    // No dates – allow all (use very old Monday)
    return NextResponse.json({ startWeek: "2000-01-01" });
  }

  const startWeek = mondayOfWeek(startDate);
  return NextResponse.json({ startWeek });
}
