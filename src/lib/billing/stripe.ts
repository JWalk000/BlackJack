import Stripe from "stripe";

let stripeSingleton: Stripe | null = null;

export function getStripeSecretKey(): string | null {
  return process.env.STRIPE_SECRET_KEY?.trim() || null;
}

export function getStripeWebhookSecret(): string | null {
  return process.env.STRIPE_WEBHOOK_SECRET?.trim() || null;
}

export function getStripePriceIdProMonthly(): string | null {
  return process.env.STRIPE_PRICE_ID_PRO_MONTHLY?.trim() || null;
}

/** Team product at $35/mo (STRIPE_PRICE_ID_TEAM_MONTHLY). */
export function getStripePriceIdTeamMonthly(): string | null {
  return process.env.STRIPE_PRICE_ID_TEAM_MONTHLY?.trim() || null;
}

export function isStripeConfigured(): boolean {
  return Boolean(getStripeSecretKey() && getStripePriceIdProMonthly());
}

/** Pro always; Team only when TEAM price env is set. */
export function isStripeTeamConfigured(): boolean {
  return Boolean(getStripeSecretKey() && getStripePriceIdTeamMonthly());
}

export type CheckoutPlanId = "pro" | "team";

export function randomIntegrationSuffix(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function getStripe(): Stripe {
  const key = getStripeSecretKey();
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }
  if (!stripeSingleton) {
    stripeSingleton = new Stripe(key, {
      apiVersion: "2026-07-29.dahlia",
    });
  }
  return stripeSingleton;
}

export function getAppUrl(request?: Request): string {
  const fromEnv =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.APP_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");

  if (request) {
    const origin = request.headers.get("origin");
    if (origin) return origin.replace(/\/$/, "");
    const host = request.headers.get("host");
    if (host) {
      const proto = request.headers.get("x-forwarded-proto") || "https";
      return `${proto}://${host}`.replace(/\/$/, "");
    }
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL.replace(/\/$/, "")}`;
  }
  return "http://localhost:3000";
}
