"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useEffect, useState } from "react";
import {
  AuthShell,
  authFieldClass,
  authLabelClass,
} from "@/components/auth/AuthShell";
import { useAuth } from "@/context/AuthContext";

function safeNext(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/workspace";
  return raw;
}

function SignupForm() {
  const { signUp, session, ready } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (ready && session) router.replace(next);
  }, [ready, session, router, next]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    const result = await signUp({ name, email, password });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push(next);
  }

  const fromDeal = next.includes("from-deal");

  return (
    <AuthShell
      eyebrow="Create account"
      title={fromDeal ? "Optional account" : "Optional account"}
      subtitle={
        fromDeal
          ? "You can already start planning as a guest. An account only helps if you want a saved profile later."
          : "Account is optional. You can use deals, planning, and workspace without signing up."
      }
      footer={
        <>
          Already have an account?{" "}
          <Link
            href={`/login?next=${encodeURIComponent(next)}`}
            className="font-medium text-copper hover:text-copper-deep"
          >
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-5">
        <label className="block">
          <span className={authLabelClass}>Full name</span>
          <input
            required
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={authFieldClass}
            placeholder="Jordan Walker"
          />
        </label>
        <label className="block">
          <span className={authLabelClass}>Email</span>
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={authFieldClass}
            placeholder="you@company.com"
          />
        </label>
        <label className="block">
          <span className={authLabelClass}>Password</span>
          <div className="relative mt-2">
            <input
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`${authFieldClass} mt-0 pr-20`}
              placeholder="At least 8 characters"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-steel hover:text-ink"
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
          <p className="mt-1.5 text-xs text-steel">
            Use 8+ characters with letters and a number.
          </p>
        </label>
        <label className="block">
          <span className={authLabelClass}>Confirm password</span>
          <input
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className={authFieldClass}
          />
        </label>
        {error && (
          <p className="border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={busy}
          className="w-full bg-ink px-4 py-3 text-sm font-medium text-paper transition hover:bg-forest disabled:opacity-60"
        >
          {busy ? "Creating account…" : "Create account"}
        </button>
      </form>
    </AuthShell>
  );
}

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center text-sm text-steel">
          Loading…
        </div>
      }
    >
      <SignupForm />
    </Suspense>
  );
}
