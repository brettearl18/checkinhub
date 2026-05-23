import Stripe from "stripe";
import {
  deriveStripeSubscriptionAccountStatus,
  type StripeSubscriptionAccountStatus,
} from "@/lib/stripe-subscription-status";
import { getAdminDb } from "@/lib/firebase-admin";

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

/** Persist subscription account status on the client doc after Stripe changes. */
export async function syncClientStripeSubscriptionFields(
  clientId: string,
  subscriptionId: string
): Promise<StripeSubscriptionAccountStatus | null> {
  const stripe = getStripe();
  if (!stripe) return null;
  const sub = await stripe.subscriptions.retrieve(subscriptionId);
  const accountStatus = deriveStripeSubscriptionAccountStatus(sub);
  const db = getAdminDb();
  await db.collection("clients").doc(clientId).update({
    stripeSubscriptionId: sub.id,
    stripeSubscriptionStatus: accountStatus,
    updatedAt: new Date(),
  });
  return accountStatus;
}
