"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { normalizePhone } from "@/lib/contact";

type Mode = "signin" | "signup";
type Method = "email" | "phone";

export function AuthPanel({
  open,
  onClose,
  initialMode = "signin",
  redirectTo = "/deals",
}: {
  open: boolean;
  onClose: () => void;
  initialMode?: Mode;
  /** Where to go after a successful sign-in (or sign-up with session). */
  redirectTo?: string;
}) {
  const router = useRouter();
  const {
    cloudReady,
    signIn,
    signUp,
    sendPhoneOtp,
    verifyPhoneOtp,
    user,
  } = useAuth();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [method, setMethod] = useState<Method>("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setMode(initialMode);
      setError(null);
      setMessage(null);
      setOtpSent(false);
      setOtp("");
    }
  }, [open, initialMode]);

  // Once a session is present (sign-in or auto-confirmed sign-up), close + go to /deals.
  useEffect(() => {
    if (!open || !user) return;
    onClose();
    router.push(redirectTo);
    router.refresh();
  }, [open, user, onClose, redirectTo, router]);

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
        return;
      }
      onClose();
      router.push(redirectTo);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function sendCode(e: React.FormEvent) {
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
      const result = await sendPhoneOtp(phone);
      if (result.error) {
        setError(result.error);
        return;
      }
      setOtpSent(true);
      setMessage(
        `Code sent to ${normalizePhone(phone) ?? phone}. Enter it below.`,
      );
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setBusy(true);
    try {
      const result = await verifyPhoneOtp(phone, otp);
      if (result.error) {
        setError(result.error);
        return;
      }
      onClose();
      router.push(redirectTo);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-ink/45 px-4 backdrop-blur-sm print:hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md border border-line bg-paper p-6 shadow-xl sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="page-label">Account</p>
            <h2 id="auth-title" className="page-title mt-2 text-3xl">
              {method === "phone"
                ? "Phone sign-in"
                : mode === "signin"
                  ? "Sign in"
                  : "Create account"}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Email + password, or SMS code when Phone is enabled in Supabase.
              Guest deals stay in this browser until you sync them.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-muted hover:text-ink"
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
          <>
            <div className="mt-6 flex border border-line">
              {(
                [
                  ["email", "Email"],
                  ["phone", "Phone"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setMethod(id);
                    setError(null);
                    setMessage(null);
                    setOtpSent(false);
                    setOtp("");
                  }}
                  className={`flex-1 px-3 py-2.5 text-sm font-semibold transition ${
                    method === id
                      ? "bg-forest text-paper"
                      : "bg-surface text-muted hover:text-ink"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {method === "email" ? (
              <form onSubmit={submitEmail} className="mt-5 space-y-4">
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
                    className="w-full border border-line bg-surface px-3 py-2.5 text-ink outline-none focus:border-canopy"
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
                    className="w-full border border-line bg-surface px-3 py-2.5 text-ink outline-none focus:border-canopy"
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
            ) : (
              <div className="mt-5 space-y-4">
                <p className="text-xs leading-relaxed text-muted">
                  Uses Supabase SMS OTP. Enable Phone under Authentication →
                  Providers and configure an SMS provider.
                </p>
                <form
                  onSubmit={otpSent ? verifyCode : sendCode}
                  className="space-y-4"
                >
                  <label className="block">
                    <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
                      Phone
                    </span>
                    <input
                      type="tel"
                      required
                      autoComplete="tel"
                      placeholder="+1 555 123 4567"
                      value={phone}
                      onChange={(e) => {
                        setPhone(e.target.value);
                        setOtpSent(false);
                        setOtp("");
                      }}
                      className="w-full border border-line bg-surface px-3 py-2.5 text-ink outline-none focus:border-canopy"
                    />
                  </label>
                  {otpSent ? (
                    <label className="block">
                      <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
                        SMS code
                      </span>
                      <input
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        required
                        value={otp}
                        onChange={(e) => setOtp(e.target.value)}
                        className="w-full border border-line bg-surface px-3 py-2.5 text-ink outline-none focus:border-canopy"
                        placeholder="6-digit code"
                      />
                    </label>
                  ) : null}
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
                      : otpSent
                        ? "Verify & sign in"
                        : "Send SMS code"}
                  </button>
                  {otpSent ? (
                    <button
                      type="button"
                      className="w-full text-center text-sm text-muted hover:text-signal"
                      disabled={busy}
                      onClick={() => {
                        setOtpSent(false);
                        setOtp("");
                        setMessage(null);
                        setError(null);
                      }}
                    >
                      Use a different number
                    </button>
                  ) : null}
                </form>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
