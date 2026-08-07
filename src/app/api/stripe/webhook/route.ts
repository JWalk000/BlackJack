import { NextResponse } from "next/server";
import type Stripe from "stripe";
import {
  getStripe,
  getStripeWebhookSecret,
} from "@/lib/billing/stripe";
import { isCloudEntitled, type PlanId } from "@/lib/billing/plans";
import {
  findUserIdByStripeCustomer,
  upsertProfileEntitlement,
} from "@/lib/billing/profiles";
import { tryCreateServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/** Disable body parsing helpers — we need the raw body for signature verify. */
export const dynamic = "force-dynamic";

function planFromSubscription(
  sub: Stripe.Subscription,
): { plan: PlanId; status: string } {
  const status = sub.status;
  // TODO(stripe): map Team price id → plan 'team' when Team Checkout is wired
  const plan: PlanId = isCloudEntitled("pro", status) ? "pro" : "free";
  return { plan, status };
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
        let plan: PlanId = "pro";
        if (session.subscription) {
          const subId =
            typeof session.subscription === "string"
              ? session.subscription
              : session.subscription.id;
          const sub = await stripe.subscriptions.retrieve(subId);
          ({ plan, status } = planFromSubscription(sub));
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
