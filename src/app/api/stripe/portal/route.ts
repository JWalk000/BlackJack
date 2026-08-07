import { NextResponse } from "next/server";
import { getAppUrl, getStripe, isStripeConfigured } from "@/lib/billing/stripe";
import { resolveRequestAuth } from "@/lib/supabase/server";
import { fetchOwnProfile } from "@/lib/billing/profiles";

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
      return NextResponse.json(
        {
          error:
            auth.status === 401
              ? "Sign in required."
              : auth.error,
        },
        { status: auth.status },
      );
    }
    const { supabase, user } = auth;

    const profile = await fetchOwnProfile(supabase, user.id);
    if (!profile?.stripe_customer_id) {
      return NextResponse.json(
        {
          error:
            "No billing customer yet. Subscribe first from the pricing page.",
        },
        { status: 400 },
      );
    }

    const stripe = getStripe();
    const appUrl = getAppUrl(request);
    const session = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${appUrl}/pricing`,
    });

    if (!session.url) {
      return NextResponse.json(
        { error: "Stripe did not return a portal URL." },
        { status: 500 },
      );
    }

    return NextResponse.json({ url: session.url });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Portal failed";
    console.error("[stripe/portal]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
