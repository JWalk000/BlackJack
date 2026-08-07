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
} from "@/lib/billing/plans";
import { AuthPanel } from "@/components/AuthPanel";
import {
  getSessionAuthHeaders,
  parseApiJson,
} from "@/lib/supabase/session-fetch";

function PricingInner() {
  const { user, loading: authLoading } = useAuth();
  const { isPro, plan, status, loading: billingLoading, refresh } =
    useBilling();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [authOpen, setAuthOpen] = useState(false);
  const [busy, setBusy] = useState<"checkout" | "portal" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  /** After sign-in from Subscribe CTA, start Stripe Checkout once. */
  const pendingCheckout = useRef(false);

  useEffect(() => {
    const checkout = searchParams.get("checkout");
    if (checkout === "success") {
      setBanner(
        "Payment received. Pro unlocks in a few seconds after Stripe confirms — refresh if the header still says Free.",
      );
      void refresh();
      const t = window.setTimeout(() => void refresh(), 2500);
      return () => window.clearTimeout(t);
    }
    if (checkout === "cancel") {
      setBanner("Checkout canceled — you can subscribe anytime.");
    }
  }, [searchParams, refresh]);

  const runCheckout = useCallback(async () => {
    setError(null);
    setBusy("checkout");
    try {
      const headers = await getSessionAuthHeaders();
      const res = await fetch("/api/stripe/checkout", {
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

  const startCheckout = useCallback(async () => {
    setError(null);
    if (authLoading) {
      setError("Checking sign-in status… try again in a moment.");
      return;
    }
    if (!user) {
      pendingCheckout.current = true;
      setAuthOpen(true);
      return;
    }
    await runCheckout();
  }, [authLoading, user, runCheckout]);

  // Resume checkout after auth panel signs the user in.
  useEffect(() => {
    if (!user || !pendingCheckout.current) return;
    pendingCheckout.current = false;
    void runCheckout();
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

  return (
    <div className="relative mx-auto max-w-6xl px-5 py-14 sm:px-8 sm:py-20">
      <div
        className="pointer-events-none absolute -right-6 top-4 font-display text-[10rem] leading-none text-ink/[0.035] sm:text-[14rem]"
        aria-hidden
      >
        $
      </div>

      <p className="page-label">Pricing</p>
      <h1 className="page-title mt-3 text-4xl sm:text-5xl">
        Free to start. Pro or Team to scale.
      </h1>
      <p className="mt-4 max-w-xl text-base leading-relaxed text-muted">
        Underwrite in the browser on Free. Pro adds unlimited cloud deals at $
        {PRO_PRICE_USD_MONTHLY}/mo. Team adds shared deals for{" "}
        {TEAM_SEAT_LIMIT} seats at ${TEAM_PRICE_USD_MONTHLY}/mo.
      </p>

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
          ) : isPro ? (
            <>
              <span className="font-semibold text-canopy">
                {plan === "team" ? "Team" : "Pro"}
              </span>
              {status ? ` (${status})` : ""}
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
          <p className="mt-3 font-display text-5xl tracking-tight text-ink">
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
          <p className="mt-3 font-display text-5xl tracking-tight">
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

          {isPro && plan === "pro" ? (
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
              disabled={busy === "checkout" || (isPro && plan === "team")}
              onClick={() => void startCheckout()}
              className="mt-10 w-full bg-signal px-6 py-3.5 text-sm font-semibold text-paper transition hover:bg-brass hover:text-ink disabled:opacity-60"
            >
              {busy === "checkout"
                ? "Redirecting…"
                : isPro && plan === "team"
                  ? "On Team plan"
                  : user
                    ? `Subscribe — $${PRO_PRICE_USD_MONTHLY}/mo`
                    : "Sign in to subscribe"}
            </button>
          )}

          {error ? (
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
          <p className="mt-3 font-display text-5xl tracking-tight text-ink">
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
          <button
            type="button"
            className="btn-signal mt-10 w-full"
            onClick={() => {
              if (!user) {
                setAuthOpen(true);
                return;
              }
              router.push("/team");
            }}
          >
            {plan === "team"
              ? "Manage team →"
              : user
                ? "Open Team — $35/mo →"
                : "Sign in for Team"}
          </button>
          <p className="mt-3 text-xs leading-relaxed text-muted">
            Team checkout in Stripe is not live yet — create a team in-app after
            sign-in.
          </p>
        </section>
      </div>

      <p className="mt-10 max-w-2xl text-sm leading-relaxed text-muted">
        Pro at ${PRO_PRICE_USD_MONTHLY}/mo is Stripe Checkout + Customer Portal.
        Team at ${TEAM_PRICE_USD_MONTHLY}/mo ({TEAM_SEAT_LIMIT} seats) is managed
        in-app for now (
        <Link href="/team" className="font-medium text-signal">
          /team
        </Link>
        ). Free includes 1 personal deal; team members can work shared team deals
        without using extra free slots.
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
          if (!user) pendingCheckout.current = false;
        }}
        initialMode="signin"
        redirectTo={null}
        onAuthenticated={() => {
          // Effect on `user` also resumes; this covers the same-frame case.
          if (pendingCheckout.current) {
            pendingCheckout.current = false;
            void runCheckout();
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
