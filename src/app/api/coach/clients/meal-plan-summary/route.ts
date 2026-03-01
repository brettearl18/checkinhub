import { NextResponse } from "next/server";
import { requireCoach } from "@/lib/api-auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { isAdminConfigured } from "@/lib/firebase-admin";

/**
 * GET: List all of the coach's clients with their meal plan allocation from the database.
 * Use this to check which clients have mealPlanLinks (or legacy mealPlanName/mealPlanUrl) set.
 */
export async function GET(request: Request) {
  const authResult = await requireCoach(request);
  if ("error" in authResult) return authResult.error;
  const coachId = authResult.identity.coachId!;

  if (!isAdminConfigured()) {
    return NextResponse.json({
      message: "Database not configured; using mock data.",
      clients: [],
    });
  }

  const db = getAdminDb();
  const snap = await db
    .collection("clients")
    .where("coachId", "==", coachId)
    .get();

  const clients = snap.docs.map((d) => {
    const data = d.data();
    const mealPlanLinks = Array.isArray(data.mealPlanLinks)
      ? (data.mealPlanLinks as { label?: string; url?: string }[]).map((l) => ({
          label: l?.label ?? "",
          url: l?.url ?? "",
        }))
      : [];
    const mealPlanName = data.mealPlanName as string | undefined;
    const mealPlanUrl = data.mealPlanUrl as string | undefined;
    const rawUpdated = data.mealPlanUpdatedAt;
    const mealPlanUpdatedAt =
      rawUpdated && typeof (rawUpdated as { toDate?: () => Date }).toDate === "function"
        ? (rawUpdated as { toDate: () => Date }).toDate().toISOString()
        : null;
    const hasAny =
      mealPlanLinks.length > 0 || (Boolean(mealPlanName) && Boolean(mealPlanUrl));

    return {
      id: d.id,
      firstName: data.firstName ?? "",
      lastName: data.lastName ?? "",
      email: data.email ?? "",
      mealPlanLinks,
      mealPlanName: mealPlanName ?? null,
      mealPlanUrl: mealPlanUrl ?? null,
      mealPlanUpdatedAt: mealPlanUpdatedAt,
      hasMealPlanAllocated: hasAny,
    };
  });

  const withAllocation = clients.filter((c) => c.hasMealPlanAllocated);

  return NextResponse.json({
    totalClients: clients.length,
    clientsWithMealPlan: withAllocation.length,
    clients: clients.map(({ hasMealPlanAllocated, ...c }) => c),
    summary: withAllocation.map((c) => ({
      id: c.id,
      name: [c.firstName, c.lastName].filter(Boolean).join(" ") || c.email,
      mealPlanLinksCount: c.mealPlanLinks.length,
      legacySinglePlan: c.mealPlanName && c.mealPlanUrl ? `${c.mealPlanName}` : null,
    })),
  });
}
