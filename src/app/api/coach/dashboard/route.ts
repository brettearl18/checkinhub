import { NextResponse } from "next/server";
import { requireCoach } from "@/lib/api-auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { isAdminConfigured } from "@/lib/firebase-admin";

function toTime(v: unknown): number {
  if (!v) return 0;
  const t = v as { toDate?: () => Date };
  if (typeof t.toDate === "function") return t.toDate().getTime();
  if (typeof v === "number") return v;
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? 0 : d.getTime();
}

const IN_CHUNK = 30;
const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// GET: business overview for coach dashboard (KPIs + check-ins to review).
export async function GET(request: Request) {
  const authResult = await requireCoach(request);
  if ("error" in authResult) return authResult.error;
  const coachId = authResult.identity.coachId!;

  if (!isAdminConfigured()) {
    return NextResponse.json({
      needsResponse: 0,
      activeClients: 0,
      formsCount: 0,
      completedThisWeek: 0,
      toReview: [],
      completed: [],
    });
  }

  const db = getAdminDb();

  const clientsSnap = await db.collection("clients").where("coachId", "==", coachId).get();
  const clientIds = clientsSnap.docs.map((d) => d.id);
  const clientNames = new Map<string, string>(
    clientsSnap.docs.map((d) => {
      const data = d.data();
      const name = [data.firstName, data.lastName].filter(Boolean).join(" ").trim() || data.email || d.id;
      return [d.id, name];
    })
  );
  const activeClients = clientsSnap.docs.filter((d) => (d.data().status as string) === "active").length;

  const formsSnap = await db.collection("forms").where("coachId", "==", coachId).get();
  const formsCount = formsSnap.docs.length;

  const allResponses: { id: string; clientId: string; formTitle: string; submittedAt: number; score: number }[] = [];

  for (let i = 0; i < clientIds.length; i += IN_CHUNK) {
    const chunk = clientIds.slice(i, i + IN_CHUNK);
    const respSnap = await db
      .collection("formResponses")
      .where("clientId", "in", chunk)
      .get();
    for (const d of respSnap.docs) {
      const data = d.data();
      allResponses.push({
        id: d.id,
        clientId: data.clientId as string,
        formTitle: (data.formTitle as string) ?? "",
        submittedAt: toTime(data.submittedAt),
        score: typeof data.score === "number" ? data.score : 0,
      });
    }
  }

  const responseIds = allResponses.map((r) => r.id);
  const responseIdsWithFeedback = new Set<string>();
  for (let i = 0; i < responseIds.length; i += IN_CHUNK) {
    const chunk = responseIds.slice(i, i + IN_CHUNK);
    const feedbackSnap = await db
      .collection("coachFeedback")
      .where("responseId", "in", chunk)
      .get();
    for (const d of feedbackSnap.docs) {
      responseIdsWithFeedback.add(d.data().responseId as string);
    }
  }

  const needsResponse = allResponses.filter((r) => !responseIdsWithFeedback.has(r.id)).length;
  const now = Date.now();
  const weekAgo = now - ONE_WEEK_MS;
  const completedThisWeek = allResponses.filter((r) => r.submittedAt >= weekAgo).length;

  const toReview = allResponses
    .filter((r) => !responseIdsWithFeedback.has(r.id))
    .sort((a, b) => b.submittedAt - a.submittedAt)
    .slice(0, 20)
    .map((r) => ({
      responseId: r.id,
      clientId: r.clientId,
      clientName: clientNames.get(r.clientId) ?? r.clientId,
      formTitle: r.formTitle,
      submittedAt: r.submittedAt,
      score: r.score,
    }));

  const completed = allResponses
    .filter((r) => responseIdsWithFeedback.has(r.id))
    .sort((a, b) => b.submittedAt - a.submittedAt)
    .slice(0, 20)
    .map((r) => ({
      responseId: r.id,
      clientId: r.clientId,
      clientName: clientNames.get(r.clientId) ?? r.clientId,
      formTitle: r.formTitle,
      submittedAt: r.submittedAt,
      score: r.score,
    }));

  return NextResponse.json({
    needsResponse,
    activeClients,
    formsCount,
    completedThisWeek,
    toReview,
    completed,
  });
}
