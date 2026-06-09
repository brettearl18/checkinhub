import { NextResponse } from "next/server";
import { requireClient } from "@/lib/api-auth";
import { isAdminConfigured } from "@/lib/firebase-admin";
import { fetchProgressTimelineForClient } from "@/lib/fetch-progress-timeline";

/** GET: merged progress timeline (check-ins, measurements, photos, habits by week). */
export async function GET(request: Request) {
  const authResult = await requireClient(request);
  if ("error" in authResult) return authResult.error;
  const clientId = authResult.identity.clientId!;
  const uid = authResult.identity.uid;

  if (!isAdminConfigured()) {
    return NextResponse.json({
      weeks: [],
      trafficLightRedMax: 40,
      trafficLightOrangeMax: 70,
    });
  }

  try {
    const extraClientIds = uid && uid !== clientId ? [uid] : undefined;
    const payload = await fetchProgressTimelineForClient(clientId, { extraClientIds });
    return NextResponse.json(payload);
  } catch (err) {
    console.error("[client/progress-timeline]", err);
    return NextResponse.json({ error: "Failed to load timeline" }, { status: 500 });
  }
}
