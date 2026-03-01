import { NextResponse } from "next/server";
import { requireCoach } from "@/lib/api-auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { getStripe } from "@/lib/stripe-server";

async function getSubscription(
  clientId: string,
  coachId: string
): Promise<
  | { subscriptionId: string; itemId: string }
  | { error: string; status: number }
> {
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
  let itemId: string | null = null;
  if (!subscriptionId) {
    const list = await stripe.subscriptions.list({
      customer: stripeCustomerId,
      status: "all",
      limit: 5,
    });
    const sub = list.data?.find(
      (s) =>
        s.status === "active" ||
        s.status === "past_due" ||
        s.status === "trialing" ||
        s.status === "paused"
    );
    if (sub) {
      subscriptionId = sub.id;
      itemId = sub.items?.data?.[0]?.id ?? null;
    }
  } else {
    const sub = await stripe.subscriptions.retrieve(subscriptionId);
    itemId = sub.items?.data?.[0]?.id ?? null;
  }
  if (!subscriptionId || !itemId) {
    return { error: "No active subscription found", status: 404 };
  }
  return { subscriptionId, itemId };
}

/**
 * POST /api/coach/clients/[clientId]/billing/update-price
 * Body: { "priceId": "price_xxx" }. Changes the subscription to the new price.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const authResult = await requireCoach(request);
  if ("error" in authResult) return authResult.error;
  const coachId = authResult.identity.coachId!;
  const { clientId } = await params;

  let body: { priceId?: string };
  try {
    body = await request.json().catch(() => ({}));
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const priceId = typeof body.priceId === "string" ? body.priceId.trim() : "";
  if (!priceId || !priceId.startsWith("price_")) {
    return NextResponse.json(
      { error: "Valid price ID (price_...) is required" },
      { status: 400 }
    );
  }

  const result = await getSubscription(clientId, coachId);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const stripe = getStripe()!;
  try {
    await stripe.subscriptions.update(result.subscriptionId, {
      items: [
        {
          id: result.itemId,
          price: priceId,
        },
      ],
      proration_behavior: "create_prorations",
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[billing/update-price]", err);
    return NextResponse.json(
      { error: "Failed to update price" },
      { status: 502 }
    );
  }
}
