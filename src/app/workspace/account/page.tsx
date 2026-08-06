"use client";

import { FormEvent, useState } from "react";
import {
  authFieldClass,
  authLabelClass,
} from "@/components/auth/AuthShell";
import { RequireAuth } from "@/components/workspace/AuthGate";
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";
import { useAuth } from "@/context/AuthContext";

function AccountInner() {
  const { session, updateProfile, changePassword, signOut } = useAuth();
  const [name, setName] = useState(session?.name ?? "");
  const [profileMsg, setProfileMsg] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileBusy, setProfileBusy] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwMsg, setPwMsg] = useState<string | null>(null);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwBusy, setPwBusy] = useState(false);

  async function onProfile(e: FormEvent) {
    e.preventDefault();
    setProfileMsg(null);
    setProfileError(null);
    setProfileBusy(true);
    const result = await updateProfile({ name });
    setProfileBusy(false);
    if (!result.ok) {
      setProfileError(result.error);
      return;
    }
    setProfileMsg("Profile updated.");
  }

  async function onPassword(e: FormEvent) {
    e.preventDefault();
    setPwMsg(null);
    setPwError(null);
    if (newPassword !== confirmPassword) {
      setPwError("New passwords do not match.");
      return;
    }
    setPwBusy(true);
    const result = await changePassword({ currentPassword, newPassword });
    setPwBusy(false);
    if (!result.ok) {
      setPwError(result.error);
      return;
    }
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setPwMsg("Password changed.");
  }

  return (
    <WorkspaceShell>
      <div className="mx-auto max-w-xl px-5 py-10 sm:px-8">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-sage">
          Account
        </p>
        <h1 className="mt-2 font-display text-4xl text-ink">Your login</h1>
        <p className="mt-2 text-sm text-steel">
          Signed in as{" "}
          <span className="font-medium text-ink">{session?.email}</span>
        </p>

        <form
          onSubmit={onProfile}
          className="mt-10 space-y-4 border border-line bg-limestone p-5 sm:p-6"
        >
          <h2 className="font-display text-xl text-ink">Profile</h2>
          <label className="block">
            <span className={authLabelClass}>Display name</span>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={authFieldClass}
            />
          </label>
          <label className="block">
            <span className={authLabelClass}>Email</span>
            <input
              disabled
              value={session?.email ?? ""}
              className={`${authFieldClass} opacity-70`}
            />
          </label>
          {profileError && (
            <p className="text-sm text-red-700">{profileError}</p>
          )}
          {profileMsg && <p className="text-sm text-canopy">{profileMsg}</p>}
          <button
            type="submit"
            disabled={profileBusy}
            className="bg-ink px-4 py-2.5 text-sm font-medium text-paper hover:bg-forest disabled:opacity-60"
          >
            {profileBusy ? "Saving…" : "Save profile"}
          </button>
        </form>

        <form
          onSubmit={onPassword}
          className="mt-6 space-y-4 border border-line bg-paper p-5 sm:p-6"
        >
          <h2 className="font-display text-xl text-ink">Change password</h2>
          <label className="block">
            <span className={authLabelClass}>Current password</span>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className={authFieldClass}
            />
          </label>
          <label className="block">
            <span className={authLabelClass}>New password</span>
            <input
              type="password"
              required
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className={authFieldClass}
            />
          </label>
          <label className="block">
            <span className={authLabelClass}>Confirm new password</span>
            <input
              type="password"
              required
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={authFieldClass}
            />
          </label>
          {pwError && <p className="text-sm text-red-700">{pwError}</p>}
          {pwMsg && <p className="text-sm text-canopy">{pwMsg}</p>}
          <button
            type="submit"
            disabled={pwBusy}
            className="bg-ink px-4 py-2.5 text-sm font-medium text-paper hover:bg-forest disabled:opacity-60"
          >
            {pwBusy ? "Updating…" : "Update password"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => {
            signOut();
            window.location.href = "/";
          }}
          className="mt-8 text-sm text-steel underline-offset-2 hover:text-ink hover:underline"
        >
          Sign out of Estate
        </button>
      </div>
    </WorkspaceShell>
  );
}

export default function AccountPage() {
  return (
    <RequireAuth>
      <AccountInner />
    </RequireAuth>
  );
}
