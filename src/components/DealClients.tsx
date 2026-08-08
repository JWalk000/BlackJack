"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  createDeal,
  dealTitle,
  deleteDeal,
  getDeal,
  listDeals,
  replaceLocalDeals,
  saveDeal,
  templateCostItems,
} from "@/lib/deals";
import type { Deal } from "@/lib/types";
import { useAuth } from "@/lib/auth-context";
import { useBilling } from "@/lib/billing/context";
import { checkCanCreateDeal } from "@/lib/billing/entitlements";
import { FREE_DEAL_LIMIT, isBillingFreeMode } from "@/lib/billing/plans";
import {
  deleteCloudDeal,
  fetchCloudDealById,
  fetchCloudDeals,
  mergeDeals,
  upsertCloudDeal,
} from "@/lib/cloud-deals";
import { claimTeamInvites, fetchMyTeam, type MyTeam } from "@/lib/teams";
// import { downloadDealExcel } from "@/lib/deal-excel"; // EXCEL_DEAL_IO — re-enable when ready
import { DealWorkspace } from "./DealWorkspace";
import { AuthPanel } from "./AuthPanel";
import { BillingToast, type BillingToastState } from "./BillingToast";
// import { DealExcelButtons } from "./DealExcelButtons"; // EXCEL_DEAL_IO — re-enable when ready

const AUTO_SAVE_MS = 500;

/** Content fingerprint ignoring updatedAt so auto-save does not loop. */
function dealContentKey(deal: Deal): string {
  const { updatedAt: _u, ...rest } = deal;
  void _u;
  return JSON.stringify(rest);
}

type SaveStatus = "idle" | "saving" | "saved" | "error";

export function NewDealClient() {
  const router = useRouter();
  const { user } = useAuth();
  const { isPro, freeMode, freeDealsCreated, recordFreeDealCreated } =
    useBilling();
  // Always honor build-time free launch lock (don't trust only context).
  const openCreate = freeMode || isBillingFreeMode();
  const [buildMode, setBuildMode] = useState<Deal["buildMode"]>("rehab");
  const [propertyClass, setPropertyClass] =
    useState<Deal["propertyClass"]>("residential");
  const [toast, setToast] = useState<BillingToastState>({
    open: false,
    message: "",
  });

  async function start() {
    // Signed-out ok: localStorage only. Never block create while product is free.
    if (openCreate) {
      const deal = createDeal({
        buildMode,
        propertyClass,
        costItems: templateCostItems(buildMode, propertyClass),
      });
      const saved = saveDeal(deal);
      if (user) void upsertCloudDeal(saved);
      router.push(`/deals/${deal.id}`);
      return;
    }

    const gate = checkCanCreateDeal(isPro, {
      cloudFreeDealsCreated: freeDealsCreated,
    });
    if (!gate.ok) {
      setToast({ open: true, message: gate.message });
      return;
    }
    const deal = createDeal({
      buildMode,
      propertyClass,
      costItems: templateCostItems(buildMode, propertyClass),
    });
    const saved = saveDeal(deal);
    if (!isPro) {
      await recordFreeDealCreated();
    }
    if (user && isPro) {
      void upsertCloudDeal(saved);
    }
    router.push(`/deals/${deal.id}`);
  }

  return (
    <div className="relative mx-auto max-w-xl px-5 py-14 sm:px-8 sm:py-20">
      <div
        className="pointer-events-none absolute -right-4 top-8 font-display text-[8rem] leading-none text-ink/[0.04] sm:text-[11rem]"
        aria-hidden
      >
        $
      </div>

      <p className="page-label">New deal</p>
      <h1 className="page-title mt-3 text-4xl sm:text-5xl">
        How are you building?
      </h1>
      <p className="mt-3 max-w-md text-base leading-relaxed text-muted">
        Ground-up or rehab, residential or commercial. You can change this
        later inside the deal.
        {!openCreate && !isPro ? (
          <>
            {" "}
            Free plan includes {FREE_DEAL_LIMIT} deal in this browser.{" "}
            <Link href="/pricing" className="font-medium text-signal">
              Upgrade to Pro
            </Link>{" "}
            for unlimited + cloud.
          </>
        ) : null}
      </p>

      <div className="relative mt-12 space-y-9">
        <div>
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
            Build path
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {(
              [
                ["rehab", "Rehab", "Improve an existing building"],
                ["new_build", "Ground-up", "Build from the dirt"],
              ] as const
            ).map(([id, title, sub]) => (
              <button
                key={id}
                type="button"
                data-active={buildMode === id}
                onClick={() => setBuildMode(id)}
                className="select-tile px-4 py-5"
              >
                <span className="block font-display text-xl tracking-tight">
                  {title}
                </span>
                <span
                  className={`mt-1.5 block text-sm leading-snug ${
                    buildMode === id ? "text-paper/75" : "text-muted"
                  }`}
                >
                  {sub}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
            Asset class
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {(
              [
                ["residential", "Residential"],
                ["commercial", "Commercial"],
              ] as const
            ).map(([id, title]) => (
              <button
                key={id}
                type="button"
                data-active={propertyClass === id}
                onClick={() => setPropertyClass(id)}
                className="select-tile px-4 py-4 font-display text-xl tracking-tight"
              >
                {title}
              </button>
            ))}
          </div>
        </div>

        <button type="button" onClick={() => void start()} className="btn-signal w-full py-3.5">
          Create deal
        </button>
      </div>
      <BillingToast
        state={toast}
        onClose={() => setToast((t) => ({ ...t, open: false }))}
      />
    </div>
  );
}

export function DealsListClient() {
  const router = useRouter();
  const { cloudReady, user, loading: authLoading } = useAuth();
  const { isPro, freeMode, freeDealsCreated } = useBilling();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [ready, setReady] = useState(false);
  const [source, setSource] = useState<"local" | "cloud" | "merged">("local");
  const [authOpen, setAuthOpen] = useState(false);
  const [migrateBusy, setMigrateBusy] = useState(false);
  const [migrateMsg, setMigrateMsg] = useState<string | null>(null);
  const [hasLocalOnly, setHasLocalOnly] = useState(false);
  const [myTeam, setMyTeam] = useState<MyTeam | null>(null);
  /** Only when paid gates on and user not entitled. */
  const freeCreateBlocked =
    !freeMode && !isPro && freeDealsCreated >= FREE_DEAL_LIMIT;

  const refresh = useCallback(async () => {
    const local = listDeals();
    let team: MyTeam | null = null;
    if (user) {
      await claimTeamInvites();
      team = await fetchMyTeam(user.id);
      setMyTeam(team);
    } else {
      setMyTeam(null);
    }

    // Pro/Team paid: full cloud. Free + team membership: team-shared deals only (RLS).
    const wantCloud = Boolean(user && (isPro || team));
    if (!wantCloud) {
      setDeals(local);
      setSource("local");
      setHasLocalOnly(false);
      setReady(true);
      return;
    }
    try {
      const cloud = await fetchCloudDeals();
      const merged = mergeDeals(local, cloud);
      replaceLocalDeals(merged);
      setDeals(merged);
      setSource(cloud.length ? "merged" : "local");
      const cloudIds = new Set(cloud.map((d) => d.id));
      setHasLocalOnly(local.some((d) => !cloudIds.has(d.id)));
    } catch {
      setDeals(local);
      setSource("local");
    }
    setReady(true);
  }, [user, isPro]);

  useEffect(() => {
    if (authLoading) return;
    void refresh();
  }, [authLoading, refresh]);

  async function uploadLocalToCloud() {
    if (!user || !isPro) return;
    setMigrateBusy(true);
    setMigrateMsg(null);
    try {
      const local = listDeals();
      let ok = 0;
      let fail = 0;
      for (const d of local) {
        const res = await upsertCloudDeal(d);
        if (res.error) fail += 1;
        else ok += 1;
      }
      setMigrateMsg(
        fail
          ? `Uploaded ${ok} · ${fail} failed (check Supabase RLS / schema).`
          : `Uploaded ${ok} deal${ok === 1 ? "" : "s"} to the cloud.`,
      );
      setHasLocalOnly(false);
      await refresh();
    } finally {
      setMigrateBusy(false);
    }
  }

  if (!ready || authLoading) {
    return (
      <div className="px-5 py-20 text-sm text-muted sm:px-8">Loading…</div>
    );
  }

  return (
    <div className="relative mx-auto max-w-6xl px-5 py-12 sm:px-8 sm:py-16">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="page-label">Workspace</p>
          <h1 className="page-title mt-2 text-4xl sm:text-5xl">My deals</h1>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-muted">
            Ground-up and rehab deal files — open any one to edit property,
            costs, and final numbers.
            {user && isPro
              ? source === "merged"
                ? " Synced with your cloud account."
                : freeMode
                  ? " Signed in — saves go to the cloud."
                  : " Pro — saves go to the cloud."
              : user && myTeam
                ? " Team deals are shared with your roster; personal free deals stay local."
                : !freeMode && !isPro
                  ? ` Free — local only (${FREE_DEAL_LIMIT} deal create).`
                  : " Stored in this browser until you sign in."}
          </p>
        </div>
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap">
          <Link href="/team" className="btn-ghost w-full sm:w-auto">
            Team
          </Link>
          {/* FIND_DEALS_NAV — re-enable when ready
          <Link href="/deals/find" className="btn-ghost w-full sm:w-auto">
            Find deals
          </Link>
          */}
          <Link
            href={freeCreateBlocked ? "/pricing" : "/deals/new"}
            className="btn-signal w-full sm:w-auto"
          >
            New deal
          </Link>
          {/* EXCEL_DEAL_IO — re-enable when ready
          <DealExcelButtons
            onImported={(d) => {
              setDeals((prev) => {
                const others = prev.filter((x) => x.id !== d.id);
                return [d, ...others];
              });
              router.push(`/deals/${d.id}`);
            }}
          />
          */}
        </div>
      </div>

      {!freeMode && !isPro ? (
        <div className="mt-8 flex flex-col gap-3 border border-line bg-stone/50 px-4 py-3 text-sm sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <p className="min-w-0 text-muted">
            Free plan:{" "}
            {freeCreateBlocked
              ? "1 free deal create used (deleting does not free a slot)"
              : "1 free deal create remaining"}{" "}
            · no personal cloud sync.
            {myTeam ? " Team-shared deals still sync for your roster." : ""}{" "}
            <Link href="/pricing" className="font-semibold text-signal">
              Upgrade to Pro ($15/mo)
            </Link>
            {" · "}
            <Link href="/team" className="font-semibold text-signal">
              Team ($35/mo)
            </Link>
          </p>
        </div>
      ) : !user ? (
        <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border border-line bg-stone/50 px-4 py-3 text-sm">
          <p className="text-muted">
            {cloudReady
              ? "Sign in to sync deals to the cloud and access them on other devices."
              : "Cloud unavailable — set Supabase env vars to enable multi-device sync. Deals still save in this browser."}
          </p>
          {cloudReady ? (
            <button
              type="button"
              className="shrink-0 font-semibold text-signal hover:text-brass-deep"
              onClick={() => setAuthOpen(true)}
            >
              Sign in
            </button>
          ) : null}
        </div>
      ) : hasLocalOnly ? (
        <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border border-canopy/30 bg-canopy/5 px-4 py-3 text-sm">
          <p className="text-muted">
            Browser deals are not fully in the cloud yet. Upload them once to
            sync.
          </p>
          <button
            type="button"
            disabled={migrateBusy}
            className="shrink-0 font-semibold text-signal hover:text-brass-deep disabled:opacity-60"
            onClick={() => void uploadLocalToCloud()}
          >
            {migrateBusy ? "Uploading…" : "Upload browser deals to cloud"}
          </button>
        </div>
      ) : null}

      {migrateMsg ? (
        <p className="mt-3 text-sm text-canopy" role="status">
          {migrateMsg}
        </p>
      ) : null}

      {deals.length === 0 ? (
        <div className="mt-14 border border-dashed border-line bg-stone/50 px-6 py-20 text-center">
          <p className="page-label">Get started</p>
          <p className="mt-3 font-display text-3xl tracking-tight text-ink">
            No deals yet
          </p>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted">
            Start a ground-up or rehab deal. Itemize costs and run final numbers
            for sell or hold.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            {/* FIND_DEALS_NAV — re-enable when ready
            <Link href="/deals/find" className="btn-ghost">
              Find deals
            </Link>
            */}
            <Link
              href={freeCreateBlocked ? "/pricing" : "/deals/new"}
              className="btn-signal"
            >
              {freeCreateBlocked
                ? "Upgrade for more deals"
                : "Create your first deal"}
            </Link>
          </div>
        </div>
      ) : (
        <ul className="mt-12 divide-y divide-line border border-line bg-surface">
          {deals.map((d) => {
            const isTeamDeal = Boolean(d.teamId);
            const canDelete =
              !d.ownerUserId || !user || d.ownerUserId === user.id;
            return (
              <li
                key={d.id}
                className="group flex flex-col gap-3 px-4 py-5 transition hover:bg-stone/40 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-4 sm:px-5"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/deals/${d.id}`}
                      className="break-words font-display text-xl tracking-tight text-ink transition group-hover:text-canopy sm:text-2xl"
                    >
                      {dealTitle(d)}
                    </Link>
                    {isTeamDeal ? (
                      <span className="border border-forest bg-forest/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-forest">
                        Team
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
                    <span className="text-signal">
                      {d.buildMode === "new_build" ? "Ground-up" : "Rehab"}
                    </span>
                    {" · "}
                    {d.propertyClass}
                    {d.property.city ? ` · ${d.property.city}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-4 sm:shrink-0">
                  {/* EXCEL_DEAL_IO — re-enable when ready
                  <button
                    type="button"
                    className="inline-flex min-h-11 items-center text-sm font-semibold text-muted transition hover:text-ink"
                    onClick={() => downloadDealExcel(d)}
                  >
                    Excel
                  </button>
                  */}
                  <Link
                    href={`/deals/${d.id}`}
                    className="inline-flex min-h-11 items-center text-sm font-semibold text-signal transition hover:text-brass-deep"
                  >
                    Open →
                  </Link>
                  {canDelete ? (
                    <button
                      type="button"
                      className="inline-flex min-h-11 items-center text-sm text-muted transition hover:text-loss"
                      onClick={() => {
                        deleteDeal(d.id);
                        if (user && isPro) void deleteCloudDeal(d.id);
                        else if (user && isTeamDeal) void deleteCloudDeal(d.id);
                        void refresh();
                      }}
                    >
                      Delete
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <AuthPanel open={authOpen} onClose={() => setAuthOpen(false)} />
    </div>
  );
}

export function DealEditorClient({ id }: { id: string }) {
  const router = useRouter();
  const { user } = useAuth();
  const { isPro, freeMode } = useBilling();
  const [deal, setDeal] = useState<Deal | null>(null);
  const [tab, setTab] = useState<"property" | "costs" | "analysis">(
    "property",
  );
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [missing, setMissing] = useState(false);
  const [cloudNote, setCloudNote] = useState<string | null>(null);
  const [myTeam, setMyTeam] = useState<MyTeam | null>(null);

  const dealRef = useRef<Deal | null>(null);
  const lastSavedKeyRef = useRef<string>("");
  const timerRef = useRef<number | null>(null);
  const userRef = useRef(user);
  const isProRef = useRef(isPro);
  const freeModeRef = useRef(freeMode);
  const myTeamRef = useRef(myTeam);
  const savedClearTimerRef = useRef<number | null>(null);

  userRef.current = user;
  isProRef.current = isPro;
  freeModeRef.current = freeMode;
  myTeamRef.current = myTeam;

  const shouldCloudSync = useCallback((d: Deal) => {
    const signedIn = Boolean(userRef.current);
    if (!signedIn) return false;
    if (isProRef.current) return true;
    // Team members can sync deals that are shared with their team
    if (d.teamId && myTeamRef.current?.team.id === d.teamId) return true;
    return false;
  }, []);

  const clearDebounce = useCallback(() => {
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const persistNow = useCallback(
    (opts?: { force?: boolean }) => {
      const current = dealRef.current;
      if (!current) return;

      const key = dealContentKey(current);
      if (!opts?.force && key === lastSavedKeyRef.current) {
        return;
      }

      clearDebounce();
      setSaveStatus("saving");

      const saved = saveDeal(current);
      lastSavedKeyRef.current = dealContentKey(saved);
      dealRef.current = saved;
      setDeal(saved);

      if (!shouldCloudSync(saved)) {
        setSaveStatus("saved");
        if (
          userRef.current &&
          !freeModeRef.current &&
          !isProRef.current &&
          !saved.teamId
        ) {
          setCloudNote(
            "Saved locally · cloud sync requires Pro or share with team",
          );
        }
        if (savedClearTimerRef.current != null) {
          window.clearTimeout(savedClearTimerRef.current);
        }
        savedClearTimerRef.current = window.setTimeout(() => {
          setSaveStatus("idle");
        }, 1600);
        return;
      }

      void upsertCloudDeal(saved).then((res) => {
        if (res.error) {
          setSaveStatus("error");
          setCloudNote(`Saved locally · cloud sync failed: ${res.error}`);
        } else {
          setSaveStatus("saved");
          setCloudNote(
            saved.teamId ? "Synced · shared with your team" : null,
          );
          if (savedClearTimerRef.current != null) {
            window.clearTimeout(savedClearTimerRef.current);
          }
          savedClearTimerRef.current = window.setTimeout(() => {
            setSaveStatus("idle");
          }, 1600);
        }
      });
    },
    [clearDebounce, shouldCloudSync],
  );

  const scheduleAutoSave = useCallback(
    (next: Deal) => {
      dealRef.current = next;
      setDeal(next);

      if (dealContentKey(next) === lastSavedKeyRef.current) {
        return;
      }

      clearDebounce();
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        persistNow();
      }, AUTO_SAVE_MS);
    },
    [clearDebounce, persistNow],
  );

  const flushSave = useCallback(() => {
    persistNow();
  }, [persistNow]);

  useEffect(() => {
    async function loadTeam() {
      if (!user) {
        setMyTeam(null);
        return;
      }
      await claimTeamInvites();
      const t = await fetchMyTeam(user.id);
      setMyTeam(t);
    }
    void loadTeam();
  }, [user]);

  useEffect(() => {
    async function load() {
      let found = getDeal(id);
      if (!found && user) {
        try {
          if (isPro || myTeam) {
            // always try id when signed in — RLS allows own or team deals
          }
          const fromCloud = await fetchCloudDealById(id);
          if (fromCloud) {
            saveDeal(fromCloud);
            found = fromCloud;
          } else if (isPro || myTeam) {
            const cloud = await fetchCloudDeals();
            const match = cloud.find((d) => d.id === id);
            if (match) {
              saveDeal(match);
              found = match;
            }
          }
        } catch {
          // ignore
        }
      }
      // Also pull fresher cloud if signed in (even when local exists)
      if (found && user && (isPro || found.teamId)) {
        try {
          const fromCloud = await fetchCloudDealById(id);
          if (
            fromCloud &&
            (fromCloud.updatedAt || "") > (found.updatedAt || "")
          ) {
            saveDeal(fromCloud);
            found = fromCloud;
          }
        } catch {
          // ignore
        }
      }
      if (!found) {
        setMissing(true);
        return;
      }
      dealRef.current = found;
      lastSavedKeyRef.current = dealContentKey(found);
      setDeal(found);
    }
    void load();
  }, [id, user, isPro, myTeam]);

  // Flush pending edits on leave / unmount.
  useEffect(() => {
    function onBeforeUnload() {
      const current = dealRef.current;
      if (!current) return;
      if (dealContentKey(current) === lastSavedKeyRef.current) return;
      try {
        const saved = saveDeal(current);
        lastSavedKeyRef.current = dealContentKey(saved);
        dealRef.current = saved;
      } catch {
        // ignore
      }
    }

    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      clearDebounce();
      if (savedClearTimerRef.current != null) {
        window.clearTimeout(savedClearTimerRef.current);
      }
      const current = dealRef.current;
      if (
        current &&
        dealContentKey(current) !== lastSavedKeyRef.current
      ) {
        const saved = saveDeal(current);
        lastSavedKeyRef.current = dealContentKey(saved);
        if (shouldCloudSync(saved)) {
          void upsertCloudDeal(saved);
        }
      }
    };
  }, [clearDebounce, shouldCloudSync]);

  if (missing) {
    return (
      <div className="mx-auto max-w-lg px-5 py-24 text-center sm:px-8">
        <p className="page-label">Missing</p>
        <p className="page-title mt-3 text-3xl">Deal not found</p>
        <Link href="/deals" className="btn-signal mt-8 inline-block">
          Back to deals
        </Link>
      </div>
    );
  }

  if (!deal) {
    return (
      <div className="px-5 py-20 text-sm text-muted sm:px-8">Loading…</div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
      {cloudNote ? (
        <p className="mb-4 text-sm text-muted" role="status">
          {cloudNote}
          {!freeMode && !isPro && !deal.teamId ? (
            <>
              {" · "}
              <Link href="/pricing" className="text-signal">
                Upgrade to Pro
              </Link>
            </>
          ) : null}
        </p>
      ) : null}
      <DealWorkspace
        deal={deal}
        tab={tab}
        onTab={setTab}
        saveStatus={saveStatus}
        onFlushSave={flushSave}
        onChange={scheduleAutoSave}
        onSave={() => {
          persistNow({ force: true });
        }}
        teamContext={
          myTeam
            ? {
                teamId: myTeam.team.id,
                teamName: myTeam.team.name,
                isOwner: myTeam.isOwner,
              }
            : null
        }
      />
      <p className="mt-12 border-t border-line pt-6">
        <button
          type="button"
          className="text-sm font-medium text-muted transition hover:text-signal"
          onClick={() => {
            flushSave();
            router.push("/deals");
          }}
        >
          ← All deals
        </button>
      </p>
    </div>
  );
}
