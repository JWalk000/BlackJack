import { listDeals } from "@/lib/deals";
import { FREE_DEAL_LIMIT } from "./plans";

/** Lifetime free creates (never decremented on delete). */
export const FREE_DEALS_CREATED_KEY = "estate.freeDealsCreated";

export const FREE_DEAL_LIMIT_MESSAGE =
  "Free plan includes 1 deal. Upgrade to Pro for more.";

function parseCount(raw: string | null): number | null {
  if (raw == null || raw === "") return null;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

/**
 * Local lifetime free creates. Missing key is seeded from existing deals so
 * pre-counter installs that already created a deal cannot mint another free one.
 * Never decrements.
 */
export function getLocalFreeDealsCreated(): number {
  if (typeof window === "undefined") return 0;
  try {
    const parsed = parseCount(localStorage.getItem(FREE_DEALS_CREATED_KEY));
    if (parsed != null) return parsed;
    const seed = listDeals().length > 0 ? FREE_DEAL_LIMIT : 0;
    localStorage.setItem(FREE_DEALS_CREATED_KEY, String(seed));
    return seed;
  } catch {
    return 0;
  }
}

/** Set local counter to at least `n` (never decreases). */
export function raiseLocalFreeDealsCreated(n: number): number {
  if (typeof window === "undefined") return 0;
  const next = Math.max(0, Math.floor(n));
  try {
    const current = getLocalFreeDealsCreated();
    const raised = Math.max(current, next);
    localStorage.setItem(FREE_DEALS_CREATED_KEY, String(raised));
    return raised;
  } catch {
    return next;
  }
}

/** Effective free creates: max(local, optional cloud/profile). Server wins when higher. */
export function getEffectiveFreeDealsCreated(
  cloudCount?: number | null,
): number {
  const local = getLocalFreeDealsCreated();
  const cloud =
    cloudCount != null && Number.isFinite(cloudCount)
      ? Math.max(0, Math.floor(cloudCount))
      : 0;
  return Math.max(local, cloud);
}

/**
 * After a successful free-tier create: bump local lifetime counter.
 * Returns the new local value (does not touch cloud — call sync separately).
 */
export function recordLocalFreeDealCreated(): number {
  return raiseLocalFreeDealsCreated(getLocalFreeDealsCreated() + 1);
}
