import { NextResponse } from "next/server";
import { requireCoach } from "@/lib/api-auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { isAdminConfigured } from "@/lib/firebase-admin";

function toDate(v: unknown): string | null {
  if (!v) return null;
  if (typeof v === "string") return v;
  const t = v as { toDate?: () => Date };
  if (typeof t.toDate === "function") return t.toDate().toISOString();
  return null;
}

// GET: client progress summary for coach (profile, measurements, goals, progress images).
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const authResult = await requireCoach(_request);
  if ("error" in authResult) return authResult.error;
  const coachId = authResult.identity.coachId!;
  const { clientId } = await params;

  if (!isAdminConfigured()) {
    return NextResponse.json({
      client: { id: clientId, firstName: "", lastName: "" },
      measurements: [],
      goals: [],
      progressImages: [],
      checkInScores: [],
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

  const data = clientSnap.data()!;
  const client = {
    id: clientSnap.id,
    firstName: (data.firstName ?? "") as string,
    lastName: (data.lastName ?? "") as string,
  };

  const [measSnap, goalsSnap, imagesSnap, responsesSnap, scoringSnap] = await Promise.all([
    db
      .collection("client_measurements")
      .where("clientId", "==", clientId)
      .orderBy("date", "desc")
      .limit(100)
      .get(),
    db.collection("clientGoals").where("clientId", "==", clientId).get(),
    db
      .collection("progress_images")
      .where("clientId", "==", clientId)
      .orderBy("uploadedAt", "desc")
      .limit(50)
      .get(),
    db
      .collection("formResponses")
      .where("clientId", "==", clientId)
      .orderBy("submittedAt", "desc")
      .limit(30)
      .get(),
    db.collection("clientScoring").doc(clientId).get(),
  ]);

  const scoring = scoringSnap.exists ? (scoringSnap.data() as { thresholds?: { red?: number[]; orange?: number[]; green?: number[] } }) : {};
  const th = scoring.thresholds ?? {};
  const trafficLightRedMax = Array.isArray(th.red) && th.red[1] != null ? th.red[1] : 40;
  const trafficLightOrangeMax = Array.isArray(th.orange) && th.orange[1] != null ? th.orange[1] : 70;

  const measurements = measSnap.docs.map((d) => {
    const m = d.data();
    const date = m.date?.toDate?.() ?? m.date;
    return {
      id: d.id,
      date: date ? new Date(date).toISOString().slice(0, 10) : null,
      bodyWeight: m.bodyWeight ?? null,
      measurements: m.measurements ?? {},
      isBaseline: m.isBaseline ?? false,
    };
  });

  const goals = goalsSnap.docs.map((d) => {
    const g = d.data();
    const deadline = g.deadline?.toDate?.() ?? g.deadline;
    return {
      id: d.id,
      title: g.title ?? "",
      description: g.description ?? "",
      category: g.category ?? "",
      targetValue: g.targetValue ?? 0,
      currentValue: g.currentValue ?? 0,
      unit: g.unit ?? "",
      deadline: deadline ? new Date(deadline).toISOString() : null,
      status: g.status ?? "active",
      progress: g.progress ?? 0,
    };
  });

  const progressImages = imagesSnap.docs.map((d) => {
    const img = d.data();
    return {
      id: d.id,
      imageUrl: img.imageUrl ?? "",
      imageType: img.imageType ?? null,
      caption: img.caption ?? null,
      uploadedAt: toDate(img.uploadedAt),
    };
  });

  const checkInScores = responsesSnap.docs.map((d) => {
    const r = d.data();
    const submittedAt = r.submittedAt?.toDate?.() ?? r.submittedAt;
    return {
      id: d.id,
      formTitle: (r.formTitle as string) ?? "",
      submittedAt: submittedAt ? new Date(submittedAt).toISOString() : null,
      score: typeof r.score === "number" ? r.score : 0,
    };
  });

  return NextResponse.json({
    client,
    measurements,
    goals,
    progressImages,
    checkInScores,
    trafficLightRedMax,
    trafficLightOrangeMax,
  });
}
