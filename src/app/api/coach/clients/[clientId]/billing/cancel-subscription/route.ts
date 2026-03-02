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
      (s) => s.status === "active" || s.status === "past_due" || s.status === "trialing" || s.status === "paused"
    );
    subscriptionId = sub?.id ?? undefined;
  }
  if (!subscriptionId) {
    return { error: "No active subscription found to cancel", status: 404 };
  }
  return { subscriptionId };
}

/**
 * POST /api/coach/clients/[clientId]/billing/cancel-subscription
 * Body (optional): { "cancelAtPeriodEnd": true } (default) or false for immediate cancel.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const authResult = await requireCoach(request);
  if ("error" in authResult) return authResult.error;
  const coachId = authResult.identity.coachId!;
  const { clientId } = await params;

  let cancelAtPeriodEnd = true;
  try {
    const body = await request.json().catch(() => ({}));
    if (typeof body.cancelAtPeriodEnd === "boolean") cancelAtPeriodEnd = body.cancelAtPeriodEnd;
  } catch {
    // keep default
  }

  const result = await getSubscriptionId(clientId, coachId);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const stripe = getStripe()!;
  try {
    if (cancelAtPeriodEnd) {
      await stripe.subscriptions.update(result.subscriptionId, {
        cancel_at_period_end: true,
      });
      return NextResponse.json({ ok: true, cancelAtPeriodEnd: true });
    } else {
      await stripe.subscriptions.cancel(result.subscriptionId);
      return NextResponse.json({ ok: true, cancelAtPeriodEnd: false });
    }
  } catch (err) {
    console.error("[billing/cancel-subscription]", err);
    return NextResponse.json(
      { error: "Failed to cancel subscription" },
      { status: 502 }
    );
  }
}
