/** Free / Pro / Team product limits for Arc Estate. */

/** Lifetime free deal creates (not concurrent slots). */
export const FREE_DEAL_LIMIT = 1;

export const PRO_PRICE_USD_MONTHLY = 15;
/** Team plan seats include the owner (creator + up to 4 invites). */
export const TEAM_PRICE_USD_MONTHLY = 35;
export const TEAM_SEAT_LIMIT = 5;

export type PlanId = "free" | "pro" | "team";

/**
 * Launch lock: product is free for everyone until you flip this off.
 * Env flags alone were still blocking deploys when accidentally set on Vercel.
 * Stripe products / Checkout / pricing UI stay available for optional pay.
 *
 * When ready to charge: set BILLING_FREE_FOR_EVERYONE = false, then set both
 *   BILLING_ENFORCED=true
 *   NEXT_PUBLIC_BILLING_ENFORCED=true
 * and redeploy.
 */
export const BILLING_FREE_FOR_EVERYONE = true;

/**
 * Product access is free until billing is turned on.
 *
 * Free mode is the DEFAULT. Unpaid / signed-out users get unlimited local deals
 * (Pro-like cloud when signed in) and team-create. Stripe stays optional.
 *
 * Only exact string "true" on both env flags enforces paywalls (and only when
 * BILLING_FREE_FOR_EVERYONE is false).
 */
export function isBillingEnforced(): boolean {
  if (BILLING_FREE_FOR_EVERYONE) return false;
  // NEXT_PUBLIC_* is inlined for browser bundles at build time.
  // BILLING_ENFORCED is server-only (API routes / SSR); undefined in client = free.
  const publicFlag = process.env.NEXT_PUBLIC_BILLING_ENFORCED;
  const serverFlag = process.env.BILLING_ENFORCED;
  return publicFlag === "true" || serverFlag === "true";
}

/** Inverse of isBillingEnforced — free product mode (default ON). */
export function isBillingFreeMode(): boolean {
  return !isBillingEnforced();
}

/** Stripe subscription statuses that count as paying (Pro or Team). */
export const PAID_ACTIVE_STATUSES = new Set([
  "active",
  "trialing",
  "past_due",
]);

/** @deprecated Use PAID_ACTIVE_STATUSES — kept for existing imports. */
export const PRO_ACTIVE_STATUSES = PAID_ACTIVE_STATUSES;

/**
 * Cloud entitlements: unlimited personal deals, cloud sync, share links.
 * Team plan owners get the same cloud toolkit as Pro, plus 5 seats.
 * Free members on a team do not get this — they only see shared team deals.
 *
 * When billing is free-mode (default), everyone is cloud-entitled without pay.
 * When BILLING_ENFORCED=true: requires plan pro|team AND a paying status
 * (Stripe is the only production writer of those fields).
 */
export function isCloudEntitled(
  plan: PlanId | string | null | undefined,
  status?: string | null,
): boolean {
  if (isBillingFreeMode()) return true;
  if (plan !== "pro" && plan !== "team") return false;
  if (!status) return false;
  return PAID_ACTIVE_STATUSES.has(status);
}

/** Pro / Team cloud — same gates used across the app as `isPro`. */
export function isProEntitled(
  plan: PlanId | string | null | undefined,
  status?: string | null,
): boolean {
  return isCloudEntitled(plan, status);
}

/**
 * Team owner / create-team / invite entitlements.
 * Free mode: all users (so create/share team works without Stripe).
 * Enforced: paid plan=team + active status only.
 */
export function isTeamPlan(
  plan: PlanId | string | null | undefined,
  status?: string | null,
): boolean {
  if (isBillingFreeMode()) return true;
  if (plan !== "team") return false;
  if (!status) return false;
  return PAID_ACTIVE_STATUSES.has(status);
}

/**
 * Real Stripe-paid Pro only (ignores free-mode product grants).
 * Use for Subscribe / Manage billing UI — not product feature gates.
 */
export function isPaidProPlan(
  plan: PlanId | string | null | undefined,
  status?: string | null,
): boolean {
  if (plan !== "pro") return false;
  if (!status) return false;
  return PAID_ACTIVE_STATUSES.has(status);
}

/**
 * Real Stripe-paid Team only (ignores free-mode product grants).
 * Use for Subscribe / Manage billing UI — not product feature gates.
 */
export function isPaidTeamPlan(
  plan: PlanId | string | null | undefined,
  status?: string | null,
): boolean {
  if (plan !== "team") return false;
  if (!status) return false;
  return PAID_ACTIVE_STATUSES.has(status);
}

export const PLAN_COPY = {
  free: {
    name: "Free",
    priceLabel: "$0",
    blurb: "Try Arc Estate in this browser.",
    features: [
      `${FREE_DEAL_LIMIT} deal (local only)`,
      "Full underwriting workspace",
      "Bank package PDF (print)",
      "No cloud sync or multi-device",
      "No shareable bank package links",
    ],
  },
  pro: {
    name: "Pro",
    priceLabel: `$${PRO_PRICE_USD_MONTHLY}`,
    priceSuffix: "/mo",
    blurb: "Unlimited deals with cloud + sharing.",
    features: [
      "Unlimited deals",
      "Cloud sync & auto-save",
      "Multi-device access when signed in",
      "Bank package share links",
      "Customer portal for billing",
    ],
  },
  team: {
    name: "Team",
    priceLabel: `$${TEAM_PRICE_USD_MONTHLY}`,
    priceSuffix: "/mo",
    blurb: `Collaborate on deals — ${TEAM_SEAT_LIMIT} seats.`,
    features: [
      "Everything in Pro",
      `${TEAM_SEAT_LIMIT} seats (owner + ${TEAM_SEAT_LIMIT - 1} invites)`,
      "Shared team deals for the whole roster",
      "Owner invites by email",
      "Create team in-app; Stripe Team Checkout available",
    ],
  },
} as const;
