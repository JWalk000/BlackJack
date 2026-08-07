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
import {
  FREE_ENTITLEMENT,
  fetchOwnProfile,
  profileToEntitlement,
  raiseProfileFreeDealsCreated,
  type Entitlement,
} from "./profiles";

type BillingContextValue = Entitlement & {
  refresh: () => Promise<void>;
  /**
   * After a successful free-tier deal create: bump local lifetime counter and
   * best-effort raise profiles.free_deals_created when signed in.
   */
  recordFreeDealCreated: () => Promise<void>;
};

const BillingContext = createContext<BillingContextValue | null>(null);

export function BillingProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading, cloudReady } = useAuth();
  const [entitlement, setEntitlement] = useState<Entitlement>({
    ...FREE_ENTITLEMENT,
    loading: true,
  });

  const refresh = useCallback(async () => {
    if (!cloudReady || !user) {
      const local = getLocalFreeDealsCreated();
      setEntitlement({
        ...FREE_ENTITLEMENT,
        freeDealsCreated: local,
        loading: false,
      });
      return;
    }
    const sb = tryCreateClient();
    if (!sb) {
      setEntitlement({
        ...FREE_ENTITLEMENT,
        freeDealsCreated: getLocalFreeDealsCreated(),
        loading: false,
      });
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
      setEntitlement({
        ...FREE_ENTITLEMENT,
        freeDealsCreated: getLocalFreeDealsCreated(),
        loading: false,
      });
    }
  }, [cloudReady, user]);

  const recordFreeDealCreated = useCallback(async () => {
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
      refresh,
      recordFreeDealCreated,
    }),
    [entitlement, refresh, recordFreeDealCreated],
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
