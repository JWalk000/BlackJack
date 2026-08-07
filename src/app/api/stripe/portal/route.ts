import { NextResponse } from "next/server";
import { getAppUrl, getStripe, isStripeConfigured } from "@/lib/billing/stripe";
import { tryCreateServerClient } from "@/lib/supabase/server";
import { fetchOwnProfile } from "@/lib/billing/profiles";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    if (!isStripeConfigured()) {
      return NextResponse.json(
        { error: "Stripe is not configured." },
        { status: 503 },
      );
    }

    const supabase = await tryCreateServerClient();
    if (!supabase) {
      return NextResponse.json(
        { error: "Auth is not configured (Supabase)." },
        { status: 503 },
      );
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    }

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

    return NextResponse.json({ url: session.url });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Portal failed";
    console.error("[stripe/portal]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
