import Stripe from "stripe";

let stripeSingleton: Stripe | null = null;
let stripeSingletonKey: string | null = null;

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

/**
 * True when Vercel/env has a real *secret* key + Pro price id.
 * Rejects publishable keys that cannot call Checkout APIs.
 */
export function isStripeConfigured(): boolean {
  const key = getStripeSecretKey();
  if (!key || !getStripePriceIdProMonthly()) return false;
  return stripeSecretKeyLooksValid(key);
}

/** Pro always; Team only when TEAM price env is set. */
export function isStripeTeamConfigured(): boolean {
  return Boolean(isStripeConfigured() && getStripePriceIdTeamMonthly());
}

export type CheckoutPlanId = "pro" | "team";

export function randomIntegrationSuffix(): string {
  return Math.random().toString(36).slice(2, 10);
}

/** Secret keys: sk_live_… / sk_test_… (never pk_…). */
export function stripeSecretKeyLooksValid(key: string): boolean {
  const k = key.trim();
  if (!k) return false;
  if (k.startsWith("pk_")) return false;
  // Restricted / full secret keys
  if (k.startsWith("sk_live_") || k.startsWith("sk_test_")) return true;
  // Rare: some accounts use rk_ restricted keys — Stripe still treats as secret-side
  if (k.startsWith("rk_live_") || k.startsWith("rk_test_")) return true;
  return false;
}

export function describeStripeKeyProblem(key: string | null): string | null {
  if (!key) {
    return "STRIPE_SECRET_KEY is not set on the server (Vercel → Environment Variables).";
  }
  if (key.startsWith("pk_") || key.toLowerCase().includes("publishable")) {
    return (
      "STRIPE_SECRET_KEY is set to a *publishable* key (pk_…). " +
      "Checkout needs the *Secret* key (sk_live_… or sk_test_…) from " +
      "https://dashboard.stripe.com/apikeys — put sk_… only in STRIPE_SECRET_KEY, " +
      "and pk_… only in NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY. Redeploy after changing."
    );
  }
  if (!stripeSecretKeyLooksValid(key)) {
    return (
      "STRIPE_SECRET_KEY does not look like a Stripe secret key. " +
      "It must start with sk_live_ or sk_test_ (Dashboard → Developers → API keys)."
    );
  }
  return null;
}

export function getStripe(): Stripe {
  const key = getStripeSecretKey();
  const problem = describeStripeKeyProblem(key);
  if (problem) {
    throw new Error(problem);
  }
  const secret = key!;
  if (!stripeSingleton || stripeSingletonKey !== secret) {
    stripeSingleton = new Stripe(secret, {
      apiVersion: "2026-07-29.dahlia",
    });
    stripeSingletonKey = secret;
  }
  return stripeSingleton;
}

/** Map raw Stripe SDK errors to actionable copy for the UI. */
export function formatStripeUserError(
  err: unknown,
  context?: { plan?: CheckoutPlanId },
): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/publishable API key/i.test(msg) || /publishable key/i.test(msg)) {
    return (
      describeStripeKeyProblem(getStripeSecretKey()) ||
      "Stripe secret key is misconfigured (publishable key used as secret)."
    );
  }
  if (
    /No such price/i.test(msg) ||
    (/resource_missing/i.test(msg) && /price/i.test(msg)) ||
    /Team price ID is wrong/i.test(msg) ||
    /Pro price ID is wrong/i.test(msg)
  ) {
    const plan = context?.plan;
    if (plan === "team" || /Team price ID is wrong/i.test(msg)) {
      return (
        "Team price ID is wrong for this Stripe account. In Stripe → Product catalog → Estate Team, " +
        "open the $35/mo price and copy Price ID (price_…). Put it in Vercel as STRIPE_PRICE_ID_TEAM_MONTHLY " +
        "(not PRO), then redeploy. Pro and Team each need their own price_ id."
      );
    }
    if (plan === "pro" || /Pro price ID is wrong/i.test(msg)) {
      return (
        "Pro price ID is wrong for this Stripe account. Copy Estate Pro’s $15/mo Price ID (price_…) into " +
        "STRIPE_PRICE_ID_PRO_MONTHLY on Vercel, then redeploy."
      );
    }
    return (
      "Stripe price ID is wrong or for a different account. " +
      "Check STRIPE_PRICE_ID_PRO_MONTHLY / STRIPE_PRICE_ID_TEAM_MONTHLY match this secret key's account."
    );
  }
  return msg || "Stripe request failed";
}

/**
 * Confirm price exists under the current secret key (clearer than Checkout “No such price”).
 */
export async function assertStripePriceId(
  priceId: string,
  plan: CheckoutPlanId,
): Promise<void> {
  const stripe = getStripe();
  try {
    const price = await stripe.prices.retrieve(priceId);
    if (!price.active) {
      throw new Error(
        plan === "team"
          ? "Team price exists but is inactive in Stripe. Activate it or choose another $35 price."
          : "Pro price exists but is inactive in Stripe. Activate it or choose another $15 price.",
      );
    }
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e);
    if (/No such price/i.test(raw) || /resource_missing/i.test(raw)) {
      throw new Error(formatStripeUserError(e, { plan }));
    }
    throw e instanceof Error ? e : new Error(String(e));
  }
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
