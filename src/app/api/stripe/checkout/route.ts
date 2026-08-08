import { NextResponse } from "next/server";
import {
  getAppUrl,
  getStripe,
  getStripePriceIdProMonthly,
  getStripePriceIdTeamMonthly,
  isStripeConfigured,
  isStripeTeamConfigured,
  randomIntegrationSuffix,
  formatStripeUserError,
  describeStripeKeyProblem,
  getStripeSecretKey,
  type CheckoutPlanId,
} from "@/lib/billing/stripe";
import {
  resolveRequestAuth,
  tryCreateServiceClient,
} from "@/lib/supabase/server";
import {
  fetchOwnProfile,
  upsertProfileEntitlement,
} from "@/lib/billing/profiles";
import type { PlanId } from "@/lib/billing/plans";

export const runtime = "nodejs";

const BILLING_NOT_CONFIGURED =
  "Billing not configured. Set STRIPE_SECRET_KEY (sk_live_… or sk_test_…) and STRIPE_PRICE_ID_PRO_MONTHLY on the server (e.g. Vercel env).";

const TEAM_BILLING_NOT_CONFIGURED =
  "Team billing not configured. Set STRIPE_PRICE_ID_TEAM_MONTHLY on the server (Team product $35/mo).";

function preservePlan(plan: PlanId | undefined): PlanId {
  if (plan === "pro" || plan === "team") return plan;
  return "free";
}

export async function POST(request: Request) {
  try {
    if (!isStripeConfigured()) {
      const keyProblem = describeStripeKeyProblem(getStripeSecretKey());
      return NextResponse.json(
        { error: keyProblem || BILLING_NOT_CONFIGURED },
        { status: 503 },
      );
    }

    const auth = await resolveRequestAuth(request);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const { supabase, user } = auth;

    let checkoutPlan: CheckoutPlanId = "pro";
    try {
      const body = (await request.json()) as { plan?: string };
      if (body?.plan === "team") checkoutPlan = "team";
      else if (body?.plan === "pro") checkoutPlan = "pro";
    } catch {
      // Empty body is fine — default Pro.
    }

    if (checkoutPlan === "team" && !isStripeTeamConfigured()) {
      return NextResponse.json(
        { error: TEAM_BILLING_NOT_CONFIGURED },
        { status: 503 },
      );
    }

    const priceId =
      checkoutPlan === "team"
        ? getStripePriceIdTeamMonthly()!
        : getStripePriceIdProMonthly()!;

    const stripe = getStripe();
    const appUrl = getAppUrl(request);

    let profile = await fetchOwnProfile(supabase, user.id);
    let customerId = profile?.stripe_customer_id ?? null;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email ?? undefined,
        metadata: { supabase_user_id: user.id },
      });
      customerId = customer.id;

      // Prefer service role so the write succeeds even if RLS blocks client updates.
      // Creating a Stripe customer must NOT promote plan — stay free until webhook.
      const service = tryCreateServiceClient() ?? supabase;
      const upsert = await upsertProfileEntitlement(service, {
        userId: user.id,
        stripeCustomerId: customerId,
        plan: preservePlan(profile?.plan),
        status: profile?.status ?? "inactive",
      });
      if (upsert.error) {
        console.warn("[checkout] profile upsert:", upsert.error);
      }
      profile = {
        ...(profile ?? {
          user_id: user.id,
          plan: "free" as const,
          status: "inactive",
          free_deals_created: 0,
          updated_at: new Date().toISOString(),
          stripe_customer_id: customerId,
        }),
        stripe_customer_id: customerId,
      };
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      client_reference_id: user.id,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/pricing?checkout=success&plan=${checkoutPlan}`,
      cancel_url: `${appUrl}/pricing?checkout=cancel`,
      // Dynamic payment methods — omit payment_method_types (Stripe best practice).
      allow_promotion_codes: true,
      subscription_data: {
        metadata: {
          supabase_user_id: user.id,
          estate_plan: checkoutPlan,
        },
      },
      metadata: {
        supabase_user_id: user.id,
        estate_plan: checkoutPlan,
      },
      integration_identifier: `estate_${checkoutPlan}_${randomIntegrationSuffix()}`,
    });

    if (!session.url) {
      return NextResponse.json(
        { error: "Stripe did not return a Checkout URL." },
        { status: 500 },
      );
    }

    return NextResponse.json({ url: session.url, sessionId: session.id });
  } catch (e) {
    const msg = formatStripeUserError(e);
    console.error("[stripe/checkout]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
