import {
  FREE_DEAL_LIMIT_MESSAGE,
  getEffectiveFreeDealsCreated,
} from "./free-deal-usage";
import { FREE_DEAL_LIMIT } from "./plans";

export type GateResult =
  | { ok: true }
  | { ok: false; reason: "deal_limit" | "cloud_pro" | "share_pro"; message: string };

/**
 * Gate new deal creation. Free users are limited by lifetime free creates
 * (not current deal list length — deleting does not free a slot).
 */
export function checkCanCreateDeal(
  isPro: boolean,
  options?: { cloudFreeDealsCreated?: number | null },
): GateResult {
  if (isPro) return { ok: true };
  const created = getEffectiveFreeDealsCreated(options?.cloudFreeDealsCreated);
  if (created >= FREE_DEAL_LIMIT) {
    return {
      ok: false,
      reason: "deal_limit",
      message: FREE_DEAL_LIMIT_MESSAGE,
    };
  }
  return { ok: true };
}

export function checkCanCloudSync(isPro: boolean): GateResult {
  if (isPro) return { ok: true };
  return {
    ok: false,
    reason: "cloud_pro",
    message:
      "Cloud sync is a Pro feature. Free plans keep deals in this browser only.",
  };
}

export function checkCanSharePackage(isPro: boolean): GateResult {
  if (isPro) return { ok: true };
  return {
    ok: false,
    reason: "share_pro",
    message:
      "Shareable bank package links are a Pro feature. Upgrade to share with lenders online (PDF print still works on Free).",
  };
}
