"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

type Mode = "signin" | "signup";

export function AuthPanel({
  open,
  onClose,
  initialMode = "signin",
  redirectTo = "/deals",
  onAuthenticated,
}: {
  open: boolean;
  onClose: () => void;
  initialMode?: Mode;
  /**
   * Where to go after a successful sign-in (or sign-up with session).
   * Pass `null` to stay on the current page (e.g. pricing → checkout).
   */
  redirectTo?: string | null;
  /** Fired after session is established, before optional navigation. */
  onAuthenticated?: () => void;
}) {
  const router = useRouter();
  const { cloudReady, signIn, signUp, user } = useAuth();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  /** Avoid double-fire from submit handler + session effect. */
  const settledRef = useRef(false);

  function finishAuth() {
    if (settledRef.current) return;
    settledRef.current = true;
    onClose();
    onAuthenticated?.();
    if (redirectTo) {
      router.push(redirectTo);
      router.refresh();
    }
  }

  useEffect(() => {
    if (open) {
      settledRef.current = false;
      setMode(initialMode);
      setError(null);
      setMessage(null);
    }
  }, [open, initialMode]);

  // Once a session is present (sign-in or auto-confirmed sign-up), close + finish.
  useEffect(() => {
    if (!open || !user) return;
    finishAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once when session appears while open
  }, [open, user]);

  if (!open) return null;

  async function submitEmail(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setBusy(true);
    try {
      if (!cloudReady) {
        setError(
          "Cloud is unavailable. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
        );
        return;
      }
      if (password.length < 6) {
        setError("Password must be at least 6 characters.");
        return;
      }
      const result =
        mode === "signin"
          ? await signIn(email.trim(), password)
          : await signUp(email.trim(), password);
      if (result.error) {
        setError(result.error);
        return;
      }
      if (mode === "signup") {
        setMessage(
          "Account created. If email confirmation is enabled in Supabase, check your inbox — otherwise you're signed in.",
        );
        // Session may appear via onAuthStateChange → finishAuth effect.
        return;
      }
      finishAuth();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-ink/45 px-0 backdrop-blur-sm print:hidden sm:items-center sm:px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="max-h-[min(92dvh,100%)] w-full max-w-md overflow-y-auto overscroll-contain border border-line bg-paper p-5 shadow-xl sm:p-8 safe-pb">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="page-label">Account</p>
            <h2 id="auth-title" className="page-title mt-2 text-2xl sm:text-3xl">
              {mode === "signin" ? "Sign in" : "Create account"}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Sign in with email and password. Guest deals stay in this browser
              until you sync them.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center text-sm text-muted hover:text-ink"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {!cloudReady ? (
          <div className="mt-6 border border-line bg-stone/60 px-4 py-3 text-sm text-muted">
            Cloud unavailable — set{" "}
            <code className="text-xs text-ink">NEXT_PUBLIC_SUPABASE_URL</code>{" "}
            and{" "}
            <code className="text-xs text-ink">
              NEXT_PUBLIC_SUPABASE_ANON_KEY
            </code>{" "}
            (see README). Bank package print still works offline.
          </div>
        ) : (
          <form onSubmit={submitEmail} className="mt-6 space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
                Email
              </span>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="min-h-11 w-full border border-line bg-surface px-3 py-2.5 text-base text-ink outline-none focus:border-canopy sm:text-sm"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
                Password
              </span>
              <input
                type="password"
                required
                minLength={6}
                autoComplete={
                  mode === "signin" ? "current-password" : "new-password"
                }
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="min-h-11 w-full border border-line bg-surface px-3 py-2.5 text-base text-ink outline-none focus:border-canopy sm:text-sm"
              />
            </label>
            {error ? (
              <p className="text-sm text-loss" role="alert">
                {error}
              </p>
            ) : null}
            {message ? (
              <p className="text-sm text-profit" role="status">
                {message}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={busy}
              className="btn-signal w-full py-3 disabled:opacity-60"
            >
              {busy
                ? "Working…"
                : mode === "signin"
                  ? "Sign in"
                  : "Create account"}
            </button>
            <button
              type="button"
              className="w-full text-center text-sm text-muted hover:text-signal"
              onClick={() => {
                setMode(mode === "signin" ? "signup" : "signin");
                setError(null);
                setMessage(null);
              }}
            >
              {mode === "signin"
                ? "Need an account? Sign up"
                : "Already have an account? Sign in"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
