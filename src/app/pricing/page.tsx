"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useBilling } from "@/lib/billing/context";
import {
  FREE_DEAL_LIMIT,
  PLAN_COPY,
  PRO_PRICE_USD_MONTHLY,
  TEAM_PRICE_USD_MONTHLY,
  TEAM_SEAT_LIMIT,
  isBillingFreeMode,
  isPaidProPlan,
  isPaidTeamPlan,
} from "@/lib/billing/plans";
import { AuthPanel } from "@/components/AuthPanel";
import {
  getSessionAuthHeaders,
  parseApiJson,
} from "@/lib/supabase/session-fetch";

function PricingInner() {
  const { user, loading: authLoading } = useAuth();
  const { isTeam, plan, status, loading: billingLoading, refresh } =
    useBilling();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [authOpen, setAuthOpen] = useState(false);
  const [busy, setBusy] = useState<"checkout" | "team" | "portal" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  /** After sign-in from Subscribe CTA, start Stripe Checkout once. */
  const pendingCheckout = useRef<"pro" | "team" | null>(null);

  useEffect(() => {
    const checkout = searchParams.get("checkout");
    const planParam = searchParams.get("plan");
    if (checkout === "success") {
      const label = planParam === "team" ? "Team" : "Pro";
      setBanner(
        `Payment received. ${label} unlocks in a few seconds after Stripe confirms — refresh if the header still says Free.`,
      );
      void refresh();
      const t = window.setTimeout(() => void refresh(), 2500);
      return () => window.clearTimeout(t);
    }
    if (checkout === "cancel") {
      setBanner("Checkout canceled — you can subscribe anytime.");
    }
  }, [searchParams, refresh]);

  const runCheckout = useCallback(async (checkoutPlan: "pro" | "team" = "pro") => {
    setError(null);
    setBusy(checkoutPlan === "team" ? "team" : "checkout");
    try {
      const headers = await getSessionAuthHeaders();
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: {
          ...headers,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ plan: checkoutPlan }),
      });
      const data = await parseApiJson<{ url?: string; error?: string }>(res);
      if (data.parseError) {
        setError(data.parseError);
        return;
      }
      if (!res.ok || !data.url) {
        setError(
          data.error ||
            (res.status === 503
              ? "Billing not configured. Ask the site owner to set Stripe env vars."
              : "Could not start Checkout."),
        );
        return;
      }
      window.location.assign(data.url);
    } catch {
      setError("Network error starting Checkout.");
    } finally {
      setBusy(null);
    }
  }, []);

  const startCheckout = useCallback(
    async (checkoutPlan: "pro" | "team" = "pro") => {
      setError(null);
      if (authLoading) {
        setError("Checking sign-in status… try again in a moment.");
        return;
      }
      if (!user) {
        pendingCheckout.current = checkoutPlan;
        setAuthOpen(true);
        return;
      }
      await runCheckout(checkoutPlan);
    },
    [authLoading, user, runCheckout],
  );

  // Resume checkout after auth panel signs the user in.
  useEffect(() => {
    if (!user || !pendingCheckout.current) return;
    const planToRun = pendingCheckout.current;
    pendingCheckout.current = null;
    void runCheckout(planToRun);
  }, [user, runCheckout]);

  const openPortal = useCallback(async () => {
    setError(null);
    if (!user) {
      setAuthOpen(true);
      return;
    }
    setBusy("portal");
    try {
      const headers = await getSessionAuthHeaders();
      const res = await fetch("/api/stripe/portal", {
        method: "POST",
        headers: {
          ...headers,
          Accept: "application/json",
        },
      });
      const data = await parseApiJson<{ url?: string; error?: string }>(res);
      if (data.parseError) {
        setError(data.parseError);
        return;
      }
      if (!res.ok || !data.url) {
        setError(data.error || "Could not open billing portal.");
        return;
      }
      window.location.assign(data.url);
    } catch {
      setError("Network error opening portal.");
    } finally {
      setBusy(null);
    }
  }, [user]);

  const free = PLAN_COPY.free;
  const pro = PLAN_COPY.pro;
  const team = PLAN_COPY.team;
  /** Real Stripe payment — not free-mode product grants. */
  const paidPro = isPaidProPlan(plan, status);
  const paidTeam = isPaidTeamPlan(plan, status);
  const freeMode = isBillingFreeMode();

  return (
    <div className="relative mx-auto max-w-6xl px-5 py-14 sm:px-8 sm:py-20">
      <div
        className="pointer-events-none absolute -right-2 top-4 max-w-[40%] overflow-hidden font-display text-[6rem] leading-none text-ink/[0.035] sm:-right-6 sm:text-[10rem] md:text-[14rem]"
        aria-hidden
      >
        $
      </div>

      <p className="page-label">Pricing</p>
      <h1 className="page-title mt-3 text-3xl sm:text-5xl">
        Free to start. Pro or Team to scale.
      </h1>
      <p className="mt-4 max-w-xl text-base leading-relaxed text-muted">
        Underwrite in the browser on Free. Pro adds unlimited cloud deals at $
        {PRO_PRICE_USD_MONTHLY}/mo. Team adds shared deals for{" "}
        {TEAM_SEAT_LIMIT} seats at ${TEAM_PRICE_USD_MONTHLY}/mo.
      </p>
      {freeMode ? (
        <p className="mt-4 max-w-xl text-sm leading-relaxed text-forest">
          Early access — full product is free for now; billing soon. Subscribe
          anytime if you want to support the build early (not required).
        </p>
      ) : null}

      {banner ? (
        <p
          className="mt-8 border border-canopy/30 bg-canopy/5 px-4 py-3 text-sm text-forest"
          role="status"
        >
          {banner}
        </p>
      ) : null}

      {!authLoading && user ? (
        <p className="mt-6 text-sm text-muted">
          Signed in as{" "}
          <span className="font-medium text-ink">{user.email}</span>
          {" · "}
          {billingLoading ? (
            "Checking plan…"
          ) : paidPro || paidTeam ? (
            <>
              <span className="font-semibold text-canopy">
                {plan === "team" ? "Team" : "Pro"}
              </span>
              {status ? ` (${status})` : ""}
            </>
          ) : freeMode ? (
            <>
              <span className="font-semibold text-canopy">Early access</span>
              {" · full product free for now"}
            </>
          ) : (
            <>
              <span className="font-semibold text-ink">Free</span>
              {FREE_DEAL_LIMIT === 1
                ? " · 1 local deal"
                : ` · up to ${FREE_DEAL_LIMIT} local deals`}
            </>
          )}
        </p>
      ) : null}

      <div className="relative mt-12 grid gap-6 lg:grid-cols-3">
        {/* Free */}
        <section className="border border-line bg-surface px-6 py-8 sm:px-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">
            {free.name}
          </p>
          <p className="mt-3 font-display text-4xl tracking-tight text-ink sm:text-5xl">
            {free.priceLabel}
          </p>
          <p className="mt-2 text-sm text-muted">{free.blurb}</p>
          <ul className="mt-8 space-y-3 border-t border-line pt-8 text-sm text-ink/90">
            {free.features.map((f) => (
              <li key={f} className="flex gap-2">
                <span className="text-muted" aria-hidden>
                  ·
                </span>
                {f}
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="btn-ghost mt-10 w-full"
            onClick={() => router.push("/deals/new")}
          >
            Continue free
          </button>
        </section>

        {/* Pro */}
        <section className="relative border border-forest bg-forest px-6 py-8 text-paper sm:px-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-signal">
            {pro.name}
          </p>
          <p className="mt-3 font-display text-4xl tracking-tight sm:text-5xl">
            {pro.priceLabel}
            <span className="ml-1 font-body text-lg font-medium text-sand/80">
              {pro.priceSuffix}
            </span>
          </p>
          <p className="mt-2 text-sm text-sand/85">{pro.blurb}</p>
          <ul className="mt-8 space-y-3 border-t border-white/15 pt-8 text-sm text-sand">
            {pro.features.map((f) => (
              <li key={f} className="flex gap-2">
                <span className="text-signal" aria-hidden>
                  ◆
                </span>
                {f}
              </li>
            ))}
          </ul>

          {paidPro && plan === "pro" ? (
            <button
              type="button"
              disabled={busy === "portal"}
              onClick={() => void openPortal()}
              className="mt-10 w-full bg-paper px-6 py-3.5 text-sm font-semibold text-ink transition hover:bg-signal hover:text-paper disabled:opacity-60"
            >
              {busy === "portal" ? "Opening…" : "Manage billing"}
            </button>
          ) : (
            <button
              type="button"
              disabled={busy === "checkout" || paidTeam}
              onClick={() => void startCheckout("pro")}
              className="mt-10 w-full bg-signal px-6 py-3.5 text-sm font-semibold text-paper transition hover:bg-brass hover:text-ink disabled:opacity-60"
            >
              {busy === "checkout"
                ? "Redirecting…"
                : paidTeam
                  ? "On Team plan"
                  : user
                    ? freeMode
                      ? `Support early — $${PRO_PRICE_USD_MONTHLY}/mo`
                      : `Subscribe — $${PRO_PRICE_USD_MONTHLY}/mo`
                    : "Sign in to subscribe"}
            </button>
          )}

          {error && busy !== "team" ? (
            <p
              className="mt-4 rounded-sm border border-loss/40 bg-loss/15 px-3 py-2 text-sm text-paper"
              role="alert"
            >
              {error}
            </p>
          ) : null}
        </section>

        {/* Team */}
        <section className="border border-line bg-surface px-6 py-8 sm:px-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">
            {team.name}
          </p>
          <p className="mt-3 font-display text-4xl tracking-tight text-ink sm:text-5xl">
            {team.priceLabel}
            <span className="ml-1 font-body text-lg font-medium text-muted">
              {team.priceSuffix}
            </span>
          </p>
          <p className="mt-2 text-sm text-muted">{team.blurb}</p>
          <ul className="mt-8 space-y-3 border-t border-line pt-8 text-sm text-ink/90">
            {team.features.map((f) => (
              <li key={f} className="flex gap-2">
                <span className="text-signal" aria-hidden>
                  ◆
                </span>
                {f}
              </li>
            ))}
          </ul>
          {paidTeam || (!freeMode && isTeam) ? (
            <button
              type="button"
              className="btn-signal mt-10 w-full"
              onClick={() => router.push("/team")}
            >
              Manage team →
            </button>
          ) : (
            <button
              type="button"
              disabled={busy === "team"}
              className="btn-signal mt-10 w-full disabled:opacity-60"
              onClick={() => void startCheckout("team")}
            >
              {busy === "team"
                ? "Redirecting…"
                : user
                  ? `$${TEAM_PRICE_USD_MONTHLY}/mo`
                  : "Sign in for Team"}
            </button>
          )}
          <p className="mt-3 text-xs leading-relaxed text-muted">
            Pay via Stripe, then set up your workspace at{" "}
            <Link href="/team" className="font-medium text-signal">
              /team
            </Link>
            . Members keep Free personal limits; team deals are shared.
          </p>
        </section>
      </div>

      {error ? (
        <p className="mt-6 text-sm text-loss" role="alert">
          {error}
        </p>
      ) : null}

      <p className="mt-10 max-w-2xl text-sm leading-relaxed text-muted">
        {freeMode ? (
          <>
            Product is free for now. Pro (${PRO_PRICE_USD_MONTHLY}/mo) and Team
            (${TEAM_PRICE_USD_MONTHLY}/mo) Checkout stay available for early
            supporters — not required. Paid status only updates after the Stripe
            webhook.
          </>
        ) : (
          <>
            Pro (${PRO_PRICE_USD_MONTHLY}/mo) and Team ($
            {TEAM_PRICE_USD_MONTHLY}/mo) both use Stripe Checkout. Paid status
            only updates after the Stripe webhook — creating a team or starting
            Checkout never unlocks Pro/Team alone. Free includes 1 personal
            deal; invited members can work shared team deals without a personal
            Pro seat.
          </>
        )}
      </p>

      <p className="mt-6 text-sm">
        <Link href="/deals" className="font-medium text-signal hover:text-brass-deep">
          ← Back to deals
        </Link>
      </p>

      <AuthPanel
        open={authOpen}
        onClose={() => {
          setAuthOpen(false);
          // User dismissed without signing in.
          if (!user) pendingCheckout.current = null;
        }}
        initialMode="signin"
        redirectTo={null}
        onAuthenticated={() => {
          // Effect on `user` also resumes; this covers the same-frame case.
          if (pendingCheckout.current) {
            const planToRun = pendingCheckout.current;
            pendingCheckout.current = null;
            void runCheckout(planToRun);
          }
        }}
      />
    </div>
  );
}

export default function PricingPage() {
  return (
    <Suspense
      fallback={
        <div className="px-5 py-20 text-sm text-muted sm:px-8">
          Loading pricing…
        </div>
      }
    >
      <PricingInner />
    </Suspense>
  );
}
