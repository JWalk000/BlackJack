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

function LoginForm() {
  const { signIn, session, ready } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (ready && session) router.replace(next);
  }, [ready, session, router, next]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const result = await signIn({ email, password });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push(next);
  }

  return (
    <AuthShell
      eyebrow="Sign in"
      title="Welcome back"
      subtitle="Sign in is optional. You can use Estate without an account — this only saves a password-protected profile on this device."
      footer={
        <>
          No account?{" "}
          <Link
            href={`/signup?next=${encodeURIComponent(next)}`}
            className="font-medium text-copper hover:text-copper-deep"
          >
            Create one
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-5">
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
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`${authFieldClass} mt-0 pr-20`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-steel hover:text-ink"
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
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
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center text-sm text-steel">
          Loading…
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
