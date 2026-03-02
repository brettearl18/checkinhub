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
    const sub = list.data?.find(
      (s) => s.status === "active" || s.status === "past_due" || s.status === "trialing"
    );
    subscriptionId = sub?.id ?? undefined;
  }
  if (!subscriptionId) {
    return { error: "No active subscription found for this customer", status: 404 };
  }
  return { subscriptionId };
}

/**
 * POST /api/coach/clients/[clientId]/billing/pause-subscription
 * Pause payment collection on the subscription. Optional body: { "resumesAt": "ISO date" }.
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

  let resumesAt: number | undefined;
  try {
    const body = await request.json().catch(() => ({}));
    const r = body.resumesAt;
    if (typeof r === "string" && r) {
      const date = new Date(r);
      if (!Number.isNaN(date.getTime())) {
        resumesAt = Math.floor(date.getTime() / 1000);
      }
    }
  } catch {
    // no body or invalid
  }

  const stripe = getStripe()!;
  try {
    await stripe.subscriptions.update(result.subscriptionId, {
      pause_collection: {
        behavior: "void",
        ...(typeof resumesAt === "number" && resumesAt > 0 && { resumes_at: resumesAt }),
      },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[billing/pause-subscription]", err);
    return NextResponse.json(
      { error: "Failed to pause subscription" },
      { status: 502 }
    );
  }
}
