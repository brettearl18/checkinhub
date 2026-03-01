import { NextResponse } from "next/server";
import { requireCoach } from "@/lib/api-auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { getStripe } from "@/lib/stripe-server";

/**
 * GET /api/coach/clients/[clientId]/billing/subscription
 * Returns the client's current subscription and price (for display and price change).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const authResult = await requireCoach(_request);
  if ("error" in authResult) return authResult.error;
  const coachId = authResult.identity.coachId!;
  const { clientId } = await params;

  const db = getAdminDb();
  const clientSnap = await db.collection("clients").doc(clientId).get();
  if (!clientSnap.exists) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }
  const data = clientSnap.data() as { coachId?: string; stripeCustomerId?: string; stripeSubscriptionId?: string };
  if (data.coachId !== coachId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const stripeCustomerId = data.stripeCustomerId;
  if (!stripeCustomerId) {
    return NextResponse.json({ subscription: null, message: "No Stripe customer linked" });
  }

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ error: "Stripe is not configured" }, { status: 503 });
  }

  try {
    let subscriptionId = data.stripeSubscriptionId;
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
      subscriptionId = sub?.id ?? null;
    }

    if (!subscriptionId) {
      return NextResponse.json({ subscription: null, message: "No subscription found" });
    }

    const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
      expand: ["items.data.price.product"],
    });

    const item = subscription.items?.data?.[0];
    const price = item?.price;
    const amount = price?.unit_amount ?? 0;
    const currency = price?.currency ?? "aud";
    const interval = price?.recurring?.interval ?? "month";
    const intervalCount = price?.recurring?.interval_count ?? 1;
    const symbol = currency === "aud" ? "A$" : currency === "usd" ? "$" : currency.toUpperCase() + " ";
    const priceStr = `${symbol}${(amount / 100).toFixed(0)}/${intervalCount === 1 ? interval : intervalCount + " " + interval + "s"}`;
    const product = price?.product as { name?: string } | string | null;
    const productName = typeof product === "object" && product?.name ? product.name : "";
    const label = productName ? `${productName} – ${priceStr}` : priceStr;

    return NextResponse.json({
      subscription: {
        id: subscription.id,
        status: subscription.status,
        currentPeriodEnd: subscription.current_period_end
          ? new Date(subscription.current_period_end * 1000).toISOString()
          : null,
        currentPrice: {
          id: price?.id,
          label,
          productName: productName || null,
          amount,
          currency,
          interval,
          intervalCount,
        },
        subscriptionItemId: item?.id,
      },
    });
  } catch (err) {
    console.error("[billing/subscription]", err);
    return NextResponse.json(
      { error: "Failed to load subscription" },
      { status: 502 }
    );
  }
}
