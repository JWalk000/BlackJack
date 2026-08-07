import { NextResponse } from "next/server";
import {
  getAppUrl,
  getStripe,
  getStripePriceIdProMonthly,
  isStripeConfigured,
  randomIntegrationSuffix,
} from "@/lib/billing/stripe";
import {
  resolveRequestAuth,
  tryCreateServiceClient,
} from "@/lib/supabase/server";
import {
  fetchOwnProfile,
  upsertProfileEntitlement,
} from "@/lib/billing/profiles";

export const runtime = "nodejs";

const BILLING_NOT_CONFIGURED =
  "Billing not configured. Set STRIPE_SECRET_KEY and STRIPE_PRICE_ID_PRO_MONTHLY on the server (e.g. Vercel env).";

export async function POST(request: Request) {
  try {
    if (!isStripeConfigured()) {
      return NextResponse.json({ error: BILLING_NOT_CONFIGURED }, { status: 503 });
    }

    const auth = await resolveRequestAuth(request);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const { supabase, user } = auth;

    const priceId = getStripePriceIdProMonthly()!;
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
      const service = tryCreateServiceClient() ?? supabase;
      const upsert = await upsertProfileEntitlement(service, {
        userId: user.id,
        stripeCustomerId: customerId,
        plan: profile?.plan === "pro" ? "pro" : "free",
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
      success_url: `${appUrl}/pricing?checkout=success`,
      cancel_url: `${appUrl}/pricing?checkout=cancel`,
      // Dynamic payment methods — omit payment_method_types (Stripe best practice).
      allow_promotion_codes: true,
      subscription_data: {
        metadata: {
          supabase_user_id: user.id,
        },
      },
      metadata: {
        supabase_user_id: user.id,
      },
      integration_identifier: `estate_pro_${randomIntegrationSuffix()}`,
    });

    if (!session.url) {
      return NextResponse.json(
        { error: "Stripe did not return a Checkout URL." },
        { status: 500 },
      );
    }

    return NextResponse.json({ url: session.url, sessionId: session.id });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Checkout failed";
    console.error("[stripe/checkout]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
