import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripe } from "@/lib/stripe-server";
import { getAdminDb } from "@/lib/firebase-admin";
import { isAdminConfigured } from "@/lib/firebase-admin";

/**
 * Stripe webhook: keep client payment status in sync.
 * Events: invoice.paid, invoice.payment_failed, customer.subscription.updated, customer.subscription.deleted.
 * Changes made in the Stripe Dashboard, Customer Billing Portal, or our app all send these events.
 */
export async function POST(request: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("[webhooks/stripe] STRIPE_WEBHOOK_SECRET not set");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    console.error("[webhooks/stripe] Signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (!isAdminConfigured()) {
    return NextResponse.json({ received: true });
  }

  const db = getAdminDb();
  const now = new Date();

  function getCustomerId(obj: { customer?: string | Stripe.Customer }): string | null {
    const c = obj.customer;
    if (!c) return null;
    return typeof c === "string" ? c : c.id ?? null;
  }

  async function updateClientByCustomerId(
    customerId: string,
    update: Record<string, unknown>
  ): Promise<void> {
    const snap = await db
      .collection("clients")
      .where("stripeCustomerId", "==", customerId)
      .limit(1)
      .get();
    if (snap.empty) return;
    await snap.docs[0].ref.update({ ...update, updatedAt: now });
  }

  try {
    switch (event.type) {
      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = getCustomerId(invoice);
        if (customerId) {
          const paidAt = invoice.status_transitions?.paid_at
            ? new Date((invoice.status_transitions.paid_at as number) * 1000)
            : now;
          let nextBilling: unknown = null;
          if (invoice.lines?.data?.[0]?.period?.end) {
            nextBilling = new Date((invoice.lines.data[0].period.end as number) * 1000);
          }
          const snap = await db
            .collection("clients")
            .where("stripeCustomerId", "==", customerId)
            .limit(1)
            .get();
          if (!snap.empty) {
            const doc = snap.docs[0];
            const existing = doc.data() as { firstPaymentAt?: unknown };
            const updatePayload: Record<string, unknown> = {
              paymentStatus: "paid",
              lastPaymentAt: paidAt,
              updatedAt: now,
              ...(nextBilling && { nextBillingAt: nextBilling }),
            };
            if (existing.firstPaymentAt == null) {
              updatePayload.firstPaymentAt = paidAt;
            }
            await doc.ref.update(updatePayload);
          }
        }
        break;
      }
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = getCustomerId(invoice);
        if (customerId) {
          await updateClientByCustomerId(customerId, { paymentStatus: "failed" });
        }
        break;
      }
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = getCustomerId(subscription);
        if (customerId) {
          const status = subscription.status;
          let paymentStatus: string =
            status === "active"
              ? "paid"
              : status === "past_due"
                ? "past_due"
                : status === "canceled" || status === "unpaid"
                  ? "canceled"
                  : "past_due";
          const nextBilling =
            subscription.current_period_end != null
              ? new Date(subscription.current_period_end * 1000)
              : null;
          await updateClientByCustomerId(customerId, {
            paymentStatus,
            stripeSubscriptionId: subscription.id ?? null,
            ...(nextBilling && { nextBillingAt: nextBilling }),
          });
        }
        break;
      }
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = getCustomerId(subscription);
        if (customerId) {
          await updateClientByCustomerId(customerId, {
            paymentStatus: "canceled",
            stripeSubscriptionId: subscription.id ?? null,
          });
        }
        break;
      }
      default:
        // ignore other events
        break;
    }
  } catch (err) {
    console.error("[webhooks/stripe] Handler error:", err);
    return NextResponse.json(
      { error: "Handler failed" },
      { status: 500 }
    );
  }

  return NextResponse.json({ received: true });
}
