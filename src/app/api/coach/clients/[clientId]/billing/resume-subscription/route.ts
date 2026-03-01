import { NextResponse } from "next/server";
import { requireCoach } from "@/lib/api-auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { getStripe } from "@/lib/stripe-server";

async function getSubscriptionId(
  clientId: string,
  coachId: string
): Promise<{ subscriptionId: string } | { error: string; status: number }> {
  const db = getAdminDb();
  const clientSnap = await db.collection("clients").doc(clientId).get();
  if (!clientSnap.exists) {
    return { error: "Client not found", status: 404 };
  }
  const data = clientSnap.data() as { coachId?: string; stripeCustomerId?: string; stripeSubscriptionId?: string };
  if (data.coachId !== coachId) {
    return { error: "Forbidden", status: 403 };
  }
  const stripeCustomerId = data.stripeCustomerId;
  if (!stripeCustomerId) {
    return { error: "No Stripe customer linked", status: 400 };
  }
  const stripe = getStripe();
  if (!stripe) {
    return { error: "Stripe is not configured", status: 503 };
  }
  let subscriptionId = data.stripeSubscriptionId;
  if (!subscriptionId) {
    const list = await stripe.subscriptions.list({
      customer: stripeCustomerId,
      status: "all",
      limit: 5,
    });
    const sub = list.data?.find((s) => s.status === "paused" || s.status === "active");
    subscriptionId = sub?.id ?? null;
  }
  if (!subscriptionId) {
    return { error: "No subscription found to resume", status: 404 };
  }
  return { subscriptionId };
}

/**
 * POST /api/coach/clients/[clientId]/billing/resume-subscription
 * Resume payment collection after a pause.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const authResult = await requireCoach(request);
  if ("error" in authResult) return authResult.error;
  const coachId = authResult.identity.coachId!;
  const { clientId } = await params;

  const result = await getSubscriptionId(clientId, coachId);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const stripe = getStripe()!;
  try {
    await stripe.subscriptions.update(result.subscriptionId, {
      pause_collection: "",
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[billing/resume-subscription]", err);
    return NextResponse.json(
      { error: "Failed to resume subscription" },
      { status: 502 }
    );
  }
}
