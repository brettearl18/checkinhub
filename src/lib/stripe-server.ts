import Stripe from "stripe";

let stripeInstance: Stripe | null = null;

/**
 * Server-side Stripe client (singleton). Requires STRIPE_SECRET_KEY in env.
 * Returns null if key is not set (e.g. Stripe not configured).
 */
export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key || key === "") return null;
  if (!stripeInstance) {
    stripeInstance = new Stripe(key);
  }
  return stripeInstance;
}
