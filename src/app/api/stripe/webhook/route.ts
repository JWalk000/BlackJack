import { NextResponse } from "next/server";
import type Stripe from "stripe";
import {
  getStripe,
  getStripePriceIdProMonthly,
  getStripePriceIdTeamMonthly,
  getStripeWebhookSecret,
} from "@/lib/billing/stripe";
import { PAID_ACTIVE_STATUSES, type PlanId } from "@/lib/billing/plans";
import {
  findUserIdByStripeCustomer,
  upsertProfileEntitlement,
} from "@/lib/billing/profiles";
import { tryCreateServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/** Disable body parsing helpers — we need the raw body for signature verify. */
export const dynamic = "force-dynamic";

function priceIdsInSubscription(sub: Stripe.Subscription): string[] {
  return (sub.items?.data ?? [])
    .map((item) => {
      const price = item.price;
      if (!price) return null;
      return typeof price === "string" ? price : price.id;
    })
    .filter((id): id is string => Boolean(id));
}

/**
 * Map Stripe subscription → Estate Arc plan.
 * Team price ID wins when present; otherwise Pro price or metadata; free if not paying.
 */
function planFromSubscription(
  sub: Stripe.Subscription,
): { plan: PlanId; status: string } {
  const status = sub.status;
  if (!PAID_ACTIVE_STATUSES.has(status)) {
    return { plan: "free", status };
  }

  const priceIds = priceIdsInSubscription(sub);
  const teamPrice = getStripePriceIdTeamMonthly();
  const proPrice = getStripePriceIdProMonthly();

  if (teamPrice && priceIds.includes(teamPrice)) {
    return { plan: "team", status };
  }
  if (proPrice && priceIds.includes(proPrice)) {
    return { plan: "pro", status };
  }

  const metaPlan = sub.metadata?.estate_plan;
  if (metaPlan === "team") return { plan: "team", status };
  if (metaPlan === "pro") return { plan: "pro", status };

  // Default paid unknown price → pro (legacy Checkouts before dual prices)
  return { plan: "pro", status };
}

async function resolveUserId(
  service: NonNullable<ReturnType<typeof tryCreateServiceClient>>,
  opts: {
    metadataUserId?: string | null;
    clientReferenceId?: string | null;
    customerId?: string | null;
  },
): Promise<string | null> {
  if (opts.metadataUserId) return opts.metadataUserId;
  if (opts.clientReferenceId) return opts.clientReferenceId;
  if (opts.customerId) {
    return findUserIdByStripeCustomer(service, opts.customerId);
  }
  return null;
}

export async function POST(request: Request) {
  const webhookSecret = getStripeWebhookSecret();
  if (!webhookSecret) {
    return NextResponse.json(
      { error: "STRIPE_WEBHOOK_SECRET is not configured" },
      { status: 503 },
    );
  }

  const service = tryCreateServiceClient();
  if (!service) {
    return NextResponse.json(
      {
        error:
          "SUPABASE_SERVICE_ROLE_KEY required for webhook entitlement updates",
      },
      { status: 503 },
    );
  }

  const stripe = getStripe();
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });
  }

  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Invalid signature";
    console.error("[stripe/webhook] signature:", msg);
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== "subscription") break;

        const customerId =
          typeof session.customer === "string"
            ? session.customer
            : session.customer?.id ?? null;

        const userId = await resolveUserId(service, {
          metadataUserId: session.metadata?.supabase_user_id,
          clientReferenceId: session.client_reference_id,
          customerId,
        });

        if (!userId) {
          console.warn("[stripe/webhook] no user for checkout.session.completed");
          break;
        }

        let status = "active";
        let plan: PlanId =
          session.metadata?.estate_plan === "team" ? "team" : "pro";
        if (session.subscription) {
          const subId =
            typeof session.subscription === "string"
              ? session.subscription
              : session.subscription.id;
          const sub = await stripe.subscriptions.retrieve(subId);
          ({ plan, status } = planFromSubscription(sub));
          // Session metadata is a reliable fall back when price env not on webhook host yet
          if (
            plan === "pro" &&
            session.metadata?.estate_plan === "team" &&
            PAID_ACTIVE_STATUSES.has(status)
          ) {
            plan = "team";
          }
        }

        await upsertProfileEntitlement(service, {
          userId,
          stripeCustomerId: customerId,
          plan,
          status,
        });
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId =
          typeof sub.customer === "string" ? sub.customer : sub.customer.id;

        const userId = await resolveUserId(service, {
          metadataUserId: sub.metadata?.supabase_user_id,
          customerId,
        });

        if (!userId) {
          console.warn(
            `[stripe/webhook] no user for ${event.type} customer=${customerId}`,
          );
          break;
        }

        const { plan, status } =
          event.type === "customer.subscription.deleted"
            ? { plan: "free" as PlanId, status: "canceled" }
            : planFromSubscription(sub);

        await upsertProfileEntitlement(service, {
          userId,
          stripeCustomerId: customerId,
          plan,
          status,
        });
        break;
      }

      default:
        // Unhandled event types are fine
        break;
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Webhook handler error";
    console.error("[stripe/webhook]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
