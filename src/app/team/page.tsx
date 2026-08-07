"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AuthPanel } from "@/components/AuthPanel";
import { useAuth } from "@/lib/auth-context";
import { useBilling } from "@/lib/billing/context";
import {
  TEAM_PRICE_USD_MONTHLY,
  TEAM_SEAT_LIMIT,
  PLAN_COPY,
} from "@/lib/billing/plans";
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
  const { isTeam, plan, refresh: refreshBilling } = useBilling();
  const [authOpen, setAuthOpen] = useState(false);
  const [myTeam, setMyTeam] = useState<MyTeam | null>(null);
  const [ready, setReady] = useState(false);
  const [name, setName] = useState("");
  const [inviteContact, setInviteContact] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

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

  async function onCreate() {
    setError(null);
    setNote(null);
    if (!user) {
      setAuthOpen(true);
      return;
    }
    setBusy("create");
    const res = await createTeam(name || "My team");
    setBusy(null);
    if (res.error) {
      setError(res.error);
      return;
    }
    setNote("Team created. Invite up to 4 teammates by email or phone.");
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
      `Invited ${contact}. They get team deals when they sign in with that email or phone.`,
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
        {teamCopy.blurb} Owner invites by email or phone ({TEAM_SEAT_LIMIT}{" "}
        seats). Members keep their own deals and see shared team deals.{" "}
        <span className="font-medium text-ink">
          ${TEAM_PRICE_USD_MONTHLY}/mo
        </span>
        {/* TODO(stripe): wire Checkout for Team price */} — Stripe billing coming
        soon; create a team in-app for now.
      </p>

      {!cloudReady ? (
        <p className="mt-8 border border-line bg-stone/50 px-4 py-3 text-sm text-muted">
          Cloud is not configured. Set Supabase env vars to use teams.
        </p>
      ) : !user ? (
        <div className="mt-8 border border-line bg-stone/50 px-4 py-5">
          <p className="text-sm text-muted">
            Sign in to create a team or accept an invite.
          </p>
          <button
            type="button"
            className="btn-signal mt-4"
            onClick={() => setAuthOpen(true)}
          >
            Sign in
          </button>
        </div>
      ) : !myTeam ? (
        <div className="mt-10 space-y-6 border border-line bg-surface p-6 sm:p-8">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
              Create team
            </p>
            <p className="mt-2 text-sm text-muted">
              You become the owner and use one seat. Invite up to{" "}
              {TEAM_SEAT_LIMIT - 1} people. Only you can add or remove members.
              {isTeam || plan === "team"
                ? " You are already on the Team plan."
                : " Creating a team marks you as Team plan (MVP until Stripe)."}
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
            </p>
          </div>

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
                        {m.phone && m.email
                          ? " · email + phone"
                          : m.phone
                            ? " · phone"
                            : " · email"}
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
                Invite by email or phone
              </p>
              <p className="mt-2 text-sm text-muted">
                {remaining > 0
                  ? `${remaining} seat${remaining === 1 ? "" : "s"} left.`
                  : "Team is full."}{" "}
                They access team deals after signing in with a matching email or
                phone (SMS OTP or email/password).
              </p>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <input
                  type="text"
                  inputMode="email"
                  autoComplete="off"
                  className="min-w-0 flex-1 border border-line bg-paper px-3 py-2.5 text-sm text-ink outline-none focus:border-forest"
                  value={inviteContact}
                  onChange={(e) => setInviteContact(e.target.value)}
                  placeholder="teammate@example.com or +1 555 123 4567"
                  disabled={remaining <= 0}
                />
                <button
                  type="button"
                  disabled={
                    remaining <= 0 ||
                    busy === "invite" ||
                    !inviteContact.trim()
                  }
                  onClick={() => void onInvite()}
                  className="btn-signal shrink-0 px-6 py-2.5 disabled:opacity-60"
                >
                  {busy === "invite" ? "Inviting…" : "Add member"}
                </button>
              </div>
            </section>
          ) : (
            <p className="text-sm text-muted">
              Only the team creator can add or remove people.
            </p>
          )}

          <p className="text-sm text-muted">
            Open a deal and use <span className="font-medium text-ink">Share with team</span>{" "}
            so everyone on the roster can view and edit it.{" "}
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

      <AuthPanel open={authOpen} onClose={() => setAuthOpen(false)} />
    </div>
  );
}
