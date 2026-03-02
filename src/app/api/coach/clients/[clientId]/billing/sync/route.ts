import { NextResponse } from "next/server";
import { requireCoach } from "@/lib/api-auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { getStripe } from "@/lib/stripe-server";

/**
 * POST /api/coach/clients/[clientId]/billing/sync
 * One-off sync: fetch subscription and invoice status from Stripe and update the client doc.
 * Use when "Not synced yet" appears (e.g. before any webhook event has been received).
 */
export async function POST(
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
  const data = clientSnap.data() as { coachId?: string; stripeCustomerId?: string };
  if (data.coachId !== coachId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const stripeCustomerId = data.stripeCustomerId;
  if (!stripeCustomerId) {
    return NextResponse.json(
      { error: "Save settings first to link this Stripe customer to the client, then try Sync from Stripe." },
      { status: 400 }
    );
  }

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ error: "Stripe is not configured" }, { status: 503 });
  }

  const now = new Date();

  try {
    let paymentStatus: string = "paid";
    let lastPaymentAt: Date | null = null;
    let nextBillingAt: Date | null = null;
    let stripeSubscriptionId: string | null = null;

    const subs = await stripe.subscriptions.list({
      customer: stripeCustomerId,
      status: "all",
      limit: 5,
    });
    const activeSub = subs.data?.find(
      (s) =>
        s.status === "active" ||
        s.status === "past_due" ||
        s.status === "trialing" ||
        s.status === "paused"
    );
    if (activeSub) {
      stripeSubscriptionId = activeSub.id;
      if (activeSub.status === "active" || activeSub.status === "trialing") {
        paymentStatus = "paid";
      } else if (activeSub.status === "past_due") {
        paymentStatus = "past_due";
      } else if (activeSub.status === "paused") {
        paymentStatus = "canceled";
      }
      if (activeSub.current_period_end) {
        nextBillingAt = new Date(activeSub.current_period_end * 1000);
      }
    } else if (subs.data?.length) {
      const last = subs.data[0];
      stripeSubscriptionId = last.id;
      if (last.status === "canceled" || last.status === "unpaid") {
        paymentStatus = "canceled";
      } else {
        paymentStatus = "past_due";
      }
    }

    const invoices = await stripe.invoices.list({
      customer: stripeCustomerId,
      status: "paid",
      limit: 1,
    });
    const lastPaid = invoices.data?.[0];
    if (lastPaid?.status_transitions?.paid_at) {
      const paidAt = new Date(lastPaid.status_transitions.paid_at * 1000);
      if (!lastPaymentAt || paidAt > lastPaymentAt) lastPaymentAt = paidAt;
    }

    const failed = await stripe.invoices.list({
      customer: stripeCustomerId,
      status: "open",
      limit: 1,
    });
    if (failed.data?.length && paymentStatus === "paid") {
      paymentStatus = "past_due";
    }

    const updatePayload: Record<string, unknown> = {
      paymentStatus,
      updatedAt: now,
      ...(stripeSubscriptionId != null ? { stripeSubscriptionId } : {}),
      ...(lastPaymentAt != null ? { lastPaymentAt } : {}),
      ...(nextBillingAt != null ? { nextBillingAt } : {}),
    };
    const existing = clientSnap.data() as { firstPaymentAt?: unknown };
    if (existing?.firstPaymentAt == null && lastPaymentAt) {
      updatePayload.firstPaymentAt = lastPaymentAt;
    }
    await clientSnap.ref.update(updatePayload);

    return NextResponse.json({ ok: true, paymentStatus });
  } catch (err) {
    console.error("[billing/sync]", err);
    return NextResponse.json(
      { error: "Failed to sync from Stripe" },
      { status: 502 }
    );
  }
}
