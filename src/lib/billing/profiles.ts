import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isCloudEntitled,
  isTeamPlan,
  type PlanId,
} from "./plans";

export type ProfileRow = {
  user_id: string;
  stripe_customer_id: string | null;
  plan: PlanId;
  status: string;
  free_deals_created: number;
  updated_at: string;
};

export type Entitlement = {
  plan: PlanId;
  status: string;
  /** Pro or Team paid cloud (unlimited deals, personal cloud, share links). */
  isPro: boolean;
  /** Owner has paid Team plan (Stripe webhook). */
  isTeam: boolean;
  stripeCustomerId: string | null;
  freeDealsCreated: number;
  loading: boolean;
};

/** Unpaid default; still honors free-mode Pro/Team access grants. */
export function freeEntitlement(
  freeDealsCreated = 0,
  loading = false,
): Entitlement {
  return {
    ...profileToEntitlement(null),
    freeDealsCreated: Math.max(0, Math.floor(freeDealsCreated)),
    loading,
  };
}

/** @deprecated Prefer freeEntitlement() — free-mode flags are env-dependent. */
export const FREE_ENTITLEMENT: Entitlement = freeEntitlement(0, false);

function normalizePlanId(raw: string | null | undefined): PlanId {
  if (raw === "pro" || raw === "team") return raw;
  return "free";
}

export function profileToEntitlement(
  row: Partial<ProfileRow> | null | undefined,
): Omit<Entitlement, "loading"> {
  const plan = normalizePlanId(row?.plan);
  const status = row?.status ?? "inactive";
  const freeDealsCreated = Math.max(
    0,
    Math.floor(Number(row?.free_deals_created) || 0),
  );
  return {
    plan,
    status,
    isPro: isCloudEntitled(plan, status),
    isTeam: isTeamPlan(plan, status),
    stripeCustomerId: row?.stripe_customer_id ?? null,
    freeDealsCreated,
  };
}

/** Browser: read own profile (RLS). Creates nothing — free by default if missing. */
export async function fetchOwnProfile(
  sb: SupabaseClient,
  userId: string,
): Promise<ProfileRow | null> {
  const { data, error } = await sb
    .from("profiles")
    .select(
      "user_id, stripe_customer_id, plan, status, free_deals_created, updated_at",
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.warn("[profiles] fetch failed:", error.message);
    return null;
  }
  if (!data) return null;
  const row = data as ProfileRow;
  return {
    ...row,
    free_deals_created: Math.max(
      0,
      Math.floor(Number(row.free_deals_created) || 0),
    ),
  };
}

/**
 * Raise lifetime free creates on profile (max only — never decreases).
 * Best-effort under RLS; plan/status cannot be changed by client policy.
 */
export async function raiseProfileFreeDealsCreated(
  sb: SupabaseClient,
  userId: string,
  count: number,
): Promise<{ freeDealsCreated: number; error?: string }> {
  const next = Math.max(0, Math.floor(count));
  const existing = await fetchOwnProfile(sb, userId);
  const raised = Math.max(existing?.free_deals_created ?? 0, next);

  const payload: Record<string, unknown> = {
    user_id: userId,
    free_deals_created: raised,
    updated_at: new Date().toISOString(),
  };
  if (!existing) {
    payload.plan = "free";
    payload.status = "inactive";
  }

  const { error } = await sb.from("profiles").upsert(payload, {
    onConflict: "user_id",
  });
  if (error) {
    console.warn("[profiles] free_deals_created raise failed:", error.message);
    return { freeDealsCreated: raised, error: error.message };
  }
  return { freeDealsCreated: raised };
}

/** Server/service role: upsert entitlement after Stripe events. */
export async function upsertProfileEntitlement(
  sb: SupabaseClient,
  input: {
    userId: string;
    stripeCustomerId?: string | null;
    plan: PlanId;
    status: string;
  },
): Promise<{ error?: string }> {
  const payload: Record<string, unknown> = {
    user_id: input.userId,
    plan: input.plan,
    status: input.status,
    updated_at: new Date().toISOString(),
  };
  if (input.stripeCustomerId !== undefined) {
    payload.stripe_customer_id = input.stripeCustomerId;
  }

  const { error } = await sb.from("profiles").upsert(payload, {
    onConflict: "user_id",
  });
  if (error) return { error: error.message };
  return {};
}

export async function findUserIdByStripeCustomer(
  sb: SupabaseClient,
  stripeCustomerId: string,
): Promise<string | null> {
  const { data, error } = await sb
    .from("profiles")
    .select("user_id")
    .eq("stripe_customer_id", stripeCustomerId)
    .maybeSingle();
  if (error || !data) return null;
  return (data as { user_id: string }).user_id;
}
