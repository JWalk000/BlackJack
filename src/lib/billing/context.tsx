"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/lib/auth-context";
import { tryCreateClient } from "@/lib/supabase/client";
import {
  getEffectiveFreeDealsCreated,
  getLocalFreeDealsCreated,
  raiseLocalFreeDealsCreated,
  recordLocalFreeDealCreated,
} from "./free-deal-usage";
import { isBillingFreeMode } from "./plans";
import {
  freeEntitlement,
  fetchOwnProfile,
  profileToEntitlement,
  raiseProfileFreeDealsCreated,
  type Entitlement,
} from "./profiles";

type BillingContextValue = Entitlement & {
  /**
   * True while product is free (default). Prefer this for paywall UI —
   * hide deal-limit banners/tooltips whenever freeMode is on.
   */
  freeMode: boolean;
  refresh: () => Promise<void>;
  /**
   * After a successful free-tier deal create: bump local lifetime counter and
   * best-effort raise profiles.free_deals_created when signed in.
   * No-op in freeMode (counters not limited).
   */
  recordFreeDealCreated: () => Promise<void>;
};

const BillingContext = createContext<BillingContextValue | null>(null);

export function BillingProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading, cloudReady } = useAuth();
  const [entitlement, setEntitlement] = useState<Entitlement>(() =>
    freeEntitlement(0, true),
  );

  const refresh = useCallback(async () => {
    if (!cloudReady || !user) {
      const local = getLocalFreeDealsCreated();
      setEntitlement(freeEntitlement(local, false));
      return;
    }
    const sb = tryCreateClient();
    if (!sb) {
      setEntitlement(freeEntitlement(getLocalFreeDealsCreated(), false));
      return;
    }
    try {
      const row = await fetchOwnProfile(sb, user.id);
      const base = profileToEntitlement(row);
      // Merge local + cloud; profile wins when higher, then write back both ways.
      const merged = getEffectiveFreeDealsCreated(base.freeDealsCreated);
      raiseLocalFreeDealsCreated(merged);
      if (merged > (row?.free_deals_created ?? 0)) {
        await raiseProfileFreeDealsCreated(sb, user.id, merged);
      }
      setEntitlement({
        ...base,
        freeDealsCreated: merged,
        loading: false,
      });
    } catch {
      setEntitlement(freeEntitlement(getLocalFreeDealsCreated(), false));
    }
  }, [cloudReady, user]);

  const freeMode = isBillingFreeMode();

  const recordFreeDealCreated = useCallback(async () => {
    // Free mode / unlimited: do not bump lifetime free counters or block create.
    if (isBillingFreeMode()) return;
    const local = recordLocalFreeDealCreated();
    setEntitlement((prev) => ({
      ...prev,
      freeDealsCreated: Math.max(prev.freeDealsCreated, local),
    }));
    if (!cloudReady || !user) return;
    const sb = tryCreateClient();
    if (!sb) return;
    const { freeDealsCreated } = await raiseProfileFreeDealsCreated(
      sb,
      user.id,
      local,
    );
    raiseLocalFreeDealsCreated(freeDealsCreated);
    setEntitlement((prev) => ({
      ...prev,
      freeDealsCreated: Math.max(prev.freeDealsCreated, freeDealsCreated),
    }));
  }, [cloudReady, user]);

  useEffect(() => {
    if (authLoading) {
      setEntitlement((prev) => ({ ...prev, loading: true }));
      return;
    }
    void refresh();
  }, [authLoading, refresh]);

  const value = useMemo(
    () => ({
      ...entitlement,
      freeMode,
      refresh,
      recordFreeDealCreated,
    }),
    [entitlement, freeMode, refresh, recordFreeDealCreated],
  );

  return (
    <BillingContext.Provider value={value}>{children}</BillingContext.Provider>
  );
}

export function useBilling(): BillingContextValue {
  const ctx = useContext(BillingContext);
  if (!ctx) {
    throw new Error("useBilling must be used within BillingProvider");
  }
  return ctx;
}
