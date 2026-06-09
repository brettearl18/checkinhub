import { NextResponse } from "next/server";
import { requireCoach } from "@/lib/api-auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { isAdminConfigured } from "@/lib/firebase-admin";
import { fetchProgressTimelineForClient } from "@/lib/fetch-progress-timeline";

/** GET: client progress timeline for coach view. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const authResult = await requireCoach(request);
  if ("error" in authResult) return authResult.error;
  const coachId = authResult.identity.coachId!;
  const { clientId } = await params;

  if (!isAdminConfigured()) {
    return NextResponse.json({
      weeks: [],
      trafficLightRedMax: 40,
      trafficLightOrangeMax: 70,
    });
  }

  const db = getAdminDb();
  const clientSnap = await db.collection("clients").doc(clientId).get();
  if (!clientSnap.exists) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }
  const clientData = clientSnap.data() as { coachId?: string };
  if (clientData.coachId !== coachId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const payload = await fetchProgressTimelineForClient(clientId);
    return NextResponse.json(payload);
  } catch (err) {
    console.error("[coach/clients/progress-timeline]", err);
    return NextResponse.json({ error: "Failed to load timeline" }, { status: 500 });
  }
}
