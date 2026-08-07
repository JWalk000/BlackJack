"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { AuthPanel } from "./AuthPanel";

export function SiteHeader() {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const isPackage =
    pathname?.includes("/package") || pathname?.startsWith("/package/");
  const { cloudReady, loading, user, signOut } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");

  if (isPackage && pathname?.startsWith("/package/")) {
    // Keep a light brand bar on public shares; hide app nav.
    return (
      <header className="print:hidden fixed inset-x-0 top-0 z-50 border-b border-line/90 bg-paper/92 text-ink backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5 sm:px-8">
          <Link href="/" className="font-display text-xl tracking-tight">
            Estate
          </Link>
          <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
            Shared package
          </span>
        </div>
      </header>
    );
  }

  return (
    <>
      <header
        className={`print:hidden fixed inset-x-0 top-0 z-50 transition-colors ${
          isHome
            ? "border-b border-white/10 bg-ink/25 text-paper backdrop-blur-md"
            : "border-b border-line/90 bg-paper/92 text-ink backdrop-blur-md"
        }`}
      >
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
          <Link
            href="/"
            className="font-display text-2xl tracking-tight transition hover:opacity-90"
          >
            Estate
          </Link>
          <nav className="flex items-center gap-2 sm:gap-4">
            <Link
              href="/deals/find"
              className={`hidden text-sm font-medium transition sm:inline ${
                isHome
                  ? "text-sand hover:opacity-70"
                  : pathname?.startsWith("/deals/find")
                    ? "text-signal"
                    : "text-muted hover:text-ink"
              }`}
            >
              Find deals
            </Link>
            <Link
              href="/deals"
              className={`text-sm font-medium transition ${
                isHome
                  ? "text-sand hover:opacity-70"
                  : pathname === "/deals"
                    ? "text-signal"
                    : "text-muted hover:text-ink"
              }`}
            >
              My deals
            </Link>
            <Link
              href="/team"
              className={`hidden text-sm font-medium transition sm:inline ${
                isHome
                  ? "text-sand hover:opacity-70"
                  : pathname === "/team"
                    ? "text-signal"
                    : "text-muted hover:text-ink"
              }`}
            >
              Team
            </Link>
            {user ? (
              <button
                type="button"
                onClick={() => void signOut()}
                title={
                  user.email
                    ? `Signed in as ${user.email} — click to sign out`
                    : "Signed in — click to sign out"
                }
                aria-label={
                  user.email
                    ? `Signed in as ${user.email}. Sign out`
                    : "Signed in. Sign out"
                }
                className="group inline-flex items-center justify-center rounded-full p-1.5 transition hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-profit"
              >
                <span
                  className="h-2.5 w-2.5 rounded-full bg-profit shadow-[0_0_0_2px] shadow-profit/25"
                  aria-hidden
                />
              </button>
            ) : loading ? (
              <span
                className={`text-sm ${isHome ? "text-sand/50" : "text-muted/60"}`}
                aria-busy="true"
                aria-label="Checking session"
              >
                …
              </span>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setAuthMode("signin");
                  setAuthOpen(true);
                }}
                className={`text-sm font-medium transition ${
                  isHome
                    ? "text-sand hover:opacity-70"
                    : "text-muted hover:text-ink"
                }`}
                title={
                  cloudReady
                    ? "Sign in to sync deals"
                    : "Cloud not configured — UI works offline"
                }
              >
                Sign in
              </button>
            )}
            <Link
              href="/deals/new"
              className={
                isHome
                  ? "bg-signal px-4 py-2 text-sm font-semibold text-paper transition hover:bg-brass hover:text-ink"
                  : "btn-signal !py-2"
              }
            >
              New deal
            </Link>
          </nav>
        </div>
      </header>
      <AuthPanel
        open={authOpen}
        initialMode={authMode}
        onClose={() => setAuthOpen(false)}
      />
    </>
  );
}
