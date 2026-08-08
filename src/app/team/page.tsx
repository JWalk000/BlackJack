"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AuthPanel } from "@/components/AuthPanel";
import { useAuth } from "@/lib/auth-context";
import { useBilling } from "@/lib/billing/context";
import {
  TEAM_PRICE_USD_MONTHLY,
  TEAM_SEAT_LIMIT,
  PLAN_COPY,
  isBillingFreeMode,
  isPaidTeamPlan,
} from "@/lib/billing/plans";
import {
  getSessionAuthHeaders,
  parseApiJson,
} from "@/lib/supabase/session-fetch";
import {
  claimTeamInvites,
  createTeam,
  fetchMyTeam,
  inviteTeamMember,
  memberLabel,
  removeTeamMember,
  seatsRemaining,
  type MyTeam,
} from "@/lib/teams";

export default function TeamPage() {
  const { cloudReady, user, loading: authLoading } = useAuth();
  const { isTeam, plan, status, refresh: refreshBilling } = useBilling();
  const [authOpen, setAuthOpen] = useState(false);
  const [myTeam, setMyTeam] = useState<MyTeam | null>(null);
  const [ready, setReady] = useState(false);
  const [name, setName] = useState("");
  const [inviteContact, setInviteContact] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const pendingTeamCheckout = useRef(false);

  const reload = useCallback(async () => {
    if (!user || !cloudReady) {
      setMyTeam(null);
      setReady(true);
      return;
    }
    setReady(false);
    await claimTeamInvites();
    const t = await fetchMyTeam(user.id);
    setMyTeam(t);
    setReady(true);
  }, [user, cloudReady]);

  useEffect(() => {
    if (authLoading) return;
    void reload();
  }, [authLoading, reload]);

  const runTeamCheckout = useCallback(async () => {
    setError(null);
    setBusy("checkout");
    try {
      const headers = await getSessionAuthHeaders();
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: {
          ...headers,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ plan: "team" }),
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
              ? "Team billing is not configured yet. Ask the site owner to set STRIPE_PRICE_ID_TEAM_MONTHLY."
              : "Could not start Team Checkout."),
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

  const startTeamSubscribe = useCallback(async () => {
    setError(null);
    if (authLoading) {
      setError("Checking sign-in status… try again in a moment.");
      return;
    }
    if (!user) {
      pendingTeamCheckout.current = true;
      setAuthOpen(true);
      return;
    }
    await runTeamCheckout();
  }, [authLoading, user, runTeamCheckout]);

  useEffect(() => {
    if (!user || !pendingTeamCheckout.current) return;
    pendingTeamCheckout.current = false;
    void runTeamCheckout();
  }, [user, runTeamCheckout]);

  async function onCreate() {
    setError(null);
    setNote(null);
    if (!user) {
      setAuthOpen(true);
      return;
    }
    if (!isTeam) {
      setError("Subscribe to Team first, then create your workspace.");
      return;
    }
    setBusy("create");
    const res = await createTeam(name || "My team");
    setBusy(null);
    if (res.error) {
      setError(res.error);
      return;
    }
    setNote("Team created. Invite up to 4 teammates by email.");
    setName("");
    await refreshBilling();
    await reload();
  }

  async function onInvite() {
    if (!myTeam?.isOwner) return;
    setError(null);
    setNote(null);
    setBusy("invite");
    const contact = inviteContact.trim();
    const res = await inviteTeamMember(myTeam.team.id, contact);
    setBusy(null);
    if (res.error) {
      setError(res.error);
      return;
    }
    setNote(
      `Invited ${contact}. They get team deals when they sign in with that email.`,
    );
    setInviteContact("");
    await reload();
  }

  async function onRemove(memberId: string, label: string) {
    if (!myTeam?.isOwner) return;
    if (!window.confirm(`Remove ${label} from the team?`)) return;
    setError(null);
    setBusy(memberId);
    const res = await removeTeamMember(memberId);
    setBusy(null);
    if (res.error) {
      setError(res.error);
      return;
    }
    setNote(`Removed ${label}.`);
    await reload();
  }

  const teamCopy = PLAN_COPY.team;
  const remaining = myTeam ? seatsRemaining(myTeam.members.length) : TEAM_SEAT_LIMIT - 1;
  const freeMode = isBillingFreeMode();
  const paidTeam = isPaidTeamPlan(plan, status);

  if (authLoading || !ready) {
    return (
      <div className="px-5 py-20 text-sm text-muted sm:px-8">Loading…</div>
    );
  }

  return (
    <div className="relative mx-auto max-w-2xl px-5 py-14 sm:px-8 sm:py-20">
      <div
        className="pointer-events-none absolute -right-4 top-6 font-display text-[8rem] leading-none text-ink/[0.04] sm:text-[11rem]"
        aria-hidden
      >
        T
      </div>

      <p className="page-label">Team</p>
      <h1 className="page-title mt-3 text-4xl sm:text-5xl">
        Collaborate on deals
      </h1>
      <p className="mt-3 max-w-lg text-base leading-relaxed text-muted">
        {teamCopy.blurb} Owner invites by email ({TEAM_SEAT_LIMIT} seats).
        {freeMode ? (
          <span className="font-medium text-ink">
            {" "}
            Early access — create a team free for now (Team will be $
            {TEAM_PRICE_USD_MONTHLY}/mo later).
          </span>
        ) : (
          <>
            {" "}
            Members keep their own free plan limits and work shared team deals.{" "}
            <span className="font-medium text-ink">
              ${TEAM_PRICE_USD_MONTHLY}/mo required for the owner
            </span>
            — no free Team unlock.
          </>
        )}
      </p>

      {!cloudReady ? (
        <p className="mt-8 border border-line bg-stone/50 px-4 py-3 text-sm text-muted">
          Cloud is not configured. Set Supabase env vars to use teams.
        </p>
      ) : !user ? (
        <div className="mt-8 border border-line bg-stone/50 px-4 py-5">
          <p className="text-sm text-muted">
            {freeMode
              ? "Sign in to create a team or accept an invite."
              : "Sign in to subscribe, create a team, or accept an invite."}
          </p>
          <button
            type="button"
            className="btn-signal mt-4"
            onClick={() => setAuthOpen(true)}
          >
            Sign in
          </button>
        </div>
      ) : !myTeam && !isTeam ? (
        <div className="mt-10 space-y-6 border border-line bg-surface p-6 sm:p-8">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
              Subscribe first
            </p>
            <p className="mt-2 text-sm text-muted">
              Team is ${TEAM_PRICE_USD_MONTHLY}/mo. Payment via Stripe unlocks
              Create team. Invited members stay on Free for personal deals and
              can still work shared team deals.
            </p>
          </div>
          <button
            type="button"
            disabled={busy === "checkout"}
            onClick={() => void startTeamSubscribe()}
            className="btn-signal w-full py-3.5 disabled:opacity-60"
          >
            {busy === "checkout"
              ? "Redirecting…"
              : `Subscribe to Team — $${TEAM_PRICE_USD_MONTHLY}/mo`}
          </button>
          <p className="text-sm text-muted">
            Need unlimited personal deals only?{" "}
            <Link href="/pricing" className="font-medium text-signal">
              Get Pro instead →
            </Link>
          </p>
        </div>
      ) : !myTeam ? (
        <div className="mt-10 space-y-6 border border-line bg-surface p-6 sm:p-8">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
              Create team
            </p>
            <p className="mt-2 text-sm text-muted">
              {freeMode
                ? "Name your workspace, then invite up to"
                : "You are on the paid Team plan. Name your workspace, then invite up to"}{" "}
              {TEAM_SEAT_LIMIT - 1} people. Only you can add or remove members.
            </p>
          </div>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-ink">
              Team name
            </span>
            <input
              className="w-full border border-line bg-paper px-3 py-2.5 text-sm text-ink outline-none focus:border-forest"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Heights Capital"
            />
          </label>
          <button
            type="button"
            disabled={busy === "create"}
            onClick={() => void onCreate()}
            className="btn-signal w-full py-3.5 disabled:opacity-60"
          >
            {busy === "create" ? "Creating…" : "Create team"}
          </button>
        </div>
      ) : (
        <div className="mt-10 space-y-8">
          <div className="border border-forest bg-forest px-6 py-6 text-paper sm:px-8">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-signal">
              Your team
            </p>
            <h2 className="mt-2 font-display text-3xl tracking-tight">
              {myTeam.team.name}
            </h2>
            <p className="mt-2 text-sm text-sand/85">
              {myTeam.members.length} / {TEAM_SEAT_LIMIT} seats
              {myTeam.isOwner ? " · you are the owner" : " · member"}
              {myTeam.isOwner && !freeMode && !paidTeam
                ? " · owner Team subscription inactive"
                : freeMode && myTeam.isOwner && !paidTeam
                  ? " · early access (free)"
                  : ""}
            </p>
          </div>

          {myTeam.isOwner && !freeMode && !paidTeam ? (
            <div className="border border-loss/40 bg-loss/5 px-4 py-3 text-sm text-ink">
              Your Team subscription is not active. Renew on Pricing to keep
              inviting and new owner features.
              <button
                type="button"
                className="ml-2 font-medium text-signal"
                disabled={busy === "checkout"}
                onClick={() => void startTeamSubscribe()}
              >
                Subscribe →
              </button>
            </div>
          ) : null}

          <section className="border border-line bg-surface">
            <div className="border-b border-line px-5 py-4 sm:px-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
                Members
              </p>
            </div>
            <ul className="divide-y divide-line">
              {myTeam.members.map((m) => {
                const label = memberLabel(m);
                return (
                  <li
                    key={m.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-6"
                  >
                    <div>
                      <p className="text-sm font-medium text-ink">{label}</p>
                      <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
                        {m.role}
                        {m.joined_at
                          ? " · joined"
                          : m.user_id
                            ? " · linked"
                            : " · invited"}
                      </p>
                    </div>
                    {myTeam.isOwner && m.role !== "owner" ? (
                      <button
                        type="button"
                        disabled={busy === m.id}
                        className="text-sm text-muted transition hover:text-loss disabled:opacity-60"
                        onClick={() => void onRemove(m.id, label)}
                      >
                        Remove
                      </button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </section>

          {myTeam.isOwner ? (
            <section className="border border-line bg-surface p-6 sm:p-8">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
                Invite by email
              </p>
              <p className="mt-2 text-sm text-muted">
                {remaining > 0
                  ? `${remaining} seat${remaining === 1 ? "" : "s"} left.`
                  : "Team is full."}{" "}
                They access team deals after signing in with a matching email.
              </p>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <input
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  className="min-w-0 flex-1 border border-line bg-paper px-3 py-2.5 text-sm text-ink outline-none focus:border-forest"
                  value={inviteContact}
                  onChange={(e) => setInviteContact(e.target.value)}
                  placeholder="teammate@example.com"
                  disabled={remaining <= 0 || !isTeam}
                />
                <button
                  type="button"
                  disabled={
                    remaining <= 0 ||
                    !isTeam ||
                    busy === "invite" ||
                    !inviteContact.trim()
                  }
                  onClick={() => void onInvite()}
                  className="btn-signal shrink-0 px-6 py-2.5 disabled:opacity-60"
                >
                  {busy === "invite" ? "Inviting…" : "Add member"}
                </button>
              </div>
              {!isTeam ? (
                <p className="mt-3 text-xs text-muted">
                  Active Team subscription required to invite new members.
                </p>
              ) : null}
            </section>
          ) : (
            <p className="text-sm text-muted">
              Only the team creator can add or remove people. You can work
              shared team deals without a personal Pro plan.
            </p>
          )}

          <p className="text-sm text-muted">
            Open a deal and use{" "}
            <span className="font-medium text-ink">Share with team</span> so
            everyone on the roster can view and edit it.{" "}
            <Link href="/deals" className="font-medium text-signal">
              My deals →
            </Link>
          </p>
        </div>
      )}

      {error ? (
        <p className="mt-6 text-sm text-loss" role="alert">
          {error}
        </p>
      ) : null}
      {note ? (
        <p className="mt-6 text-sm text-canopy" role="status">
          {note}
        </p>
      ) : null}

      <p className="mt-10 text-sm">
        <Link href="/pricing" className="font-medium text-muted hover:text-ink">
          Compare plans →
        </Link>
      </p>

      <AuthPanel
        open={authOpen}
        onClose={() => {
          setAuthOpen(false);
          if (!user) pendingTeamCheckout.current = false;
        }}
        onAuthenticated={() => {
          if (pendingTeamCheckout.current) {
            pendingTeamCheckout.current = false;
            void runTeamCheckout();
          }
        }}
      />
    </div>
  );
}
