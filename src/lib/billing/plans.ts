/** Free / Pro / Team product limits for Estate. */

/** Lifetime free deal creates (not concurrent slots). */
export const FREE_DEAL_LIMIT = 1;

export const PRO_PRICE_USD_MONTHLY = 15;
/** Team plan seats include the owner (creator + up to 4 invites). */
export const TEAM_PRICE_USD_MONTHLY = 35;
export const TEAM_SEAT_LIMIT = 5;

export type PlanId = "free" | "pro" | "team";

/** Stripe subscription statuses that count as paying (Pro or Team). */
export const PAID_ACTIVE_STATUSES = new Set([
  "active",
  "trialing",
  "past_due",
]);

/** @deprecated Use PAID_ACTIVE_STATUSES — kept for existing imports. */
export const PRO_ACTIVE_STATUSES = PAID_ACTIVE_STATUSES;

/**
 * Paid cloud entitlements: unlimited personal deals, cloud sync, share links.
 * Team plan owners get the same cloud toolkit as Pro, plus 5 seats.
 * Free members on a team do not get this — they only see shared team deals.
 */
export function isCloudEntitled(
  plan: PlanId | string | null | undefined,
  status?: string | null,
): boolean {
  if (plan !== "pro" && plan !== "team") return false;
  if (!status) return true;
  return PAID_ACTIVE_STATUSES.has(status);
}

/** Pro / Team cloud — same gates used across the app as `isPro`. */
export function isProEntitled(
  plan: PlanId | string | null | undefined,
  status?: string | null,
): boolean {
  return isCloudEntitled(plan, status);
}

export function isTeamPlan(
  plan: PlanId | string | null | undefined,
  status?: string | null,
): boolean {
  if (plan !== "team") return false;
  if (!status) return true;
  return PAID_ACTIVE_STATUSES.has(status);
}

export const PLAN_COPY = {
  free: {
    name: "Free",
    priceLabel: "$0",
    blurb: "Try Estate in this browser.",
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
      "Owner invites by email or phone",
      "Create team in-app (Stripe Team Checkout soon)",
    ],
  },
} as const;
