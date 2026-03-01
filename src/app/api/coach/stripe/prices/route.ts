import { NextResponse } from "next/server";
import { requireCoach } from "@/lib/api-auth";
import { getStripe } from "@/lib/stripe-server";

function formatPrice(amount: number, currency: string, interval: string, intervalCount: number): string {
  const code = (currency || "aud").toUpperCase();
  const symbol = code === "AUD" ? "A$" : code === "USD" ? "$" : code + " ";
  const per = intervalCount === 1 ? `/${interval}` : `/${intervalCount} ${interval}s`;
  return `${symbol}${(amount / 100).toFixed(0)}${per}`;
}

/**
 * GET /api/coach/stripe/prices
 * Returns active recurring prices for the Stripe account (for changing subscription price in settings).
 */
export async function GET(request: Request) {
  const authResult = await requireCoach(request);
  if ("error" in authResult) return authResult.error;

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json(
      { error: "Stripe is not configured" },
      { status: 503 }
    );
  }

  try {
    const list = await stripe.prices.list({
      active: true,
      type: "recurring",
      limit: 50,
      expand: ["data.product"],
    });

    const prices = (list.data ?? []).map((p) => {
      const amount = p.unit_amount ?? 0;
      const currency = p.currency ?? "aud";
      const interval = p.recurring?.interval ?? "month";
      const intervalCount = p.recurring?.interval_count ?? 1;
      const priceStr = formatPrice(amount, currency, interval, intervalCount);
      const product = p.product as { name?: string } | string | null;
      const productName = typeof product === "object" && product?.name ? product.name : "";
      const label = productName ? `${productName} – ${priceStr}` : priceStr;
      return {
        id: p.id,
        label,
        productName: productName || null,
        amount,
        currency,
        interval,
        intervalCount,
      };
    });

    return NextResponse.json({ prices });
  } catch (err) {
    console.error("[coach/stripe/prices]", err);
    return NextResponse.json(
      { error: "Failed to load prices" },
      { status: 502 }
    );
  }
}
