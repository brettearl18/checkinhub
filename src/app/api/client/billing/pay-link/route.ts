import { NextResponse } from "next/server";
import { requireClient } from "@/lib/api-auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { getStripe } from "@/lib/stripe-server";

/**
 * GET /api/client/billing/pay-link
 * Returns the Stripe hosted invoice URL for the client's latest open invoice, if any.
 * Lets the client pay an outstanding balance on the client portal.
 */
export async function GET(request: Request) {
  const authResult = await requireClient(request);
  if ("error" in authResult) return authResult.error;
  const clientId = authResult.identity.clientId!;

  const db = getAdminDb();
  const clientSnap = await db.collection("clients").doc(clientId).get();
  if (!clientSnap.exists) {
    return NextResponse.json({ url: null });
  }
  const data = clientSnap.data() as { stripeCustomerId?: string | null };
  const stripeCustomerId = data.stripeCustomerId ?? null;
  if (!stripeCustomerId) {
    return NextResponse.json({ url: null });
  }

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ url: null });
  }

  try {
    const list = await stripe.invoices.list({
      customer: stripeCustomerId,
      status: "open",
      limit: 1,
    });
    const invoice = list.data?.[0];
    const url = invoice?.hosted_invoice_url ?? null;
    return NextResponse.json({ url });
  } catch (err) {
    console.error("[client/billing/pay-link]", err);
    return NextResponse.json({ url: null });
  }
}
