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
const MAX_LIST = 500;

/**
 * GET: Full list of check-ins to review and completed (for Check-ins Management page).
 * Returns all items up to MAX_LIST; dashboard API only returns 20 for KPIs.
 */
export async function GET(request: Request) {
  const authResult = await requireCoach(request);
  if ("error" in authResult) return authResult.error;
  const coachId = authResult.identity.coachId!;

  if (!isAdminConfigured()) {
    return NextResponse.json({
      needsResponse: 0,
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

  const allResponses: {
    id: string;
    clientId: string;
    formTitle: string;
    submittedAt: number;
    score: number;
    coachResponded?: boolean;
    reviewedByCoach?: boolean;
  }[] = [];

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
        coachResponded: data.coachResponded === true,
        reviewedByCoach: data.reviewedByCoach === true,
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

  const isDone = (r: (typeof allResponses)[0]) =>
    r.coachResponded === true || r.reviewedByCoach === true || responseIdsWithFeedback.has(r.id);
  const needsResponse = allResponses.filter((r) => !isDone(r)).length;

  const toReview = allResponses
    .filter((r) => !isDone(r))
    .sort((a, b) => b.submittedAt - a.submittedAt)
    .slice(0, MAX_LIST)
    .map((r) => ({
      responseId: r.id,
      clientId: r.clientId,
      clientName: clientNames.get(r.clientId) ?? r.clientId,
      formTitle: r.formTitle,
      submittedAt: r.submittedAt,
      score: r.score,
    }));

  const completed = allResponses
    .filter((r) => isDone(r))
    .sort((a, b) => b.submittedAt - a.submittedAt)
    .slice(0, MAX_LIST)
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
    toReview,
    completed,
  });
}
