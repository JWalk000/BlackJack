"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { AuthPanel } from "./AuthPanel";

function NavLink({
  href,
  children,
  isHome,
  active,
  onClick,
  className = "",
}: {
  href: string;
  children: React.ReactNode;
  isHome: boolean;
  active: boolean;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`inline-flex min-h-11 items-center text-sm font-medium transition ${
        isHome
          ? active
            ? "text-paper"
            : "text-sand hover:opacity-70"
          : active
            ? "text-signal"
            : "text-muted hover:text-ink"
      } ${className}`}
    >
      {children}
    </Link>
  );
}

export function SiteHeader() {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const isPackage =
    pathname?.includes("/package") || pathname?.startsWith("/package/");
  const { cloudReady, loading, user, signOut } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [menuOpen, setMenuOpen] = useState(false);

  // Close mobile menu on route change
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  // Lock body scroll when menu open
  useEffect(() => {
    if (!menuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [menuOpen]);

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
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-5 sm:px-8">
          <Link
            href="/"
            className="shrink-0 font-display text-2xl tracking-tight transition hover:opacity-90"
          >
            Estate
          </Link>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-5 md:flex">
            {/* FIND_DEALS_NAV — re-enable when ready
            <NavLink
              href="/deals/find"
              isHome={isHome}
              active={Boolean(pathname?.startsWith("/deals/find"))}
            >
              Find deals
            </NavLink>
            */}
            <NavLink
              href="/deals"
              isHome={isHome}
              active={pathname === "/deals"}
            >
              My deals
            </NavLink>
            <NavLink
              href="/team"
              isHome={isHome}
              active={pathname === "/team"}
            >
              Team
            </NavLink>
            <NavLink
              href="/pricing"
              isHome={isHome}
              active={pathname === "/pricing"}
            >
              Pricing
            </NavLink>
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
                className="group inline-flex min-h-11 min-w-11 items-center justify-center rounded-full p-1.5 transition hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-profit"
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
                className={`inline-flex min-h-11 items-center text-sm font-medium transition ${
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
                  ? "inline-flex min-h-11 max-w-[11.5rem] items-center justify-center bg-signal px-3 py-2 text-center text-[13px] font-semibold leading-tight text-paper transition hover:bg-brass hover:text-ink lg:max-w-none lg:px-4 lg:text-sm"
                  : "btn-signal !min-h-11 !max-w-[11.5rem] !px-3 !py-2 !text-center !text-[13px] !leading-tight lg:!max-w-none lg:!px-4 lg:!text-sm"
              }
            >
              Develop the numbers
            </Link>
          </nav>

          {/* Mobile: CTA + menu toggle */}
          <div className="flex items-center gap-2 md:hidden">
            <Link
              href="/deals/new"
              className={
                isHome
                  ? "inline-flex min-h-11 max-w-[9.5rem] items-center justify-center bg-signal px-2.5 py-1.5 text-center text-[11px] font-semibold leading-tight text-paper transition hover:bg-brass hover:text-ink"
                  : "btn-signal !min-h-11 !max-w-[9.5rem] !px-2.5 !py-1.5 !text-center !text-[11px] !leading-tight"
              }
            >
              Develop the numbers
            </Link>
            <button
              type="button"
              className={`inline-flex min-h-11 min-w-11 items-center justify-center border transition ${
                isHome
                  ? "border-paper/35 text-paper hover:bg-paper/10"
                  : "border-line text-ink hover:bg-surface"
              }`}
              aria-expanded={menuOpen}
              aria-controls="mobile-nav"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              onClick={() => setMenuOpen((o) => !o)}
            >
              <span className="sr-only">{menuOpen ? "Close" : "Menu"}</span>
              <span className="relative block h-3.5 w-5" aria-hidden>
                <span
                  className={`absolute left-0 h-0.5 w-5 bg-current transition ${
                    menuOpen ? "top-1.5 rotate-45" : "top-0"
                  }`}
                />
                <span
                  className={`absolute left-0 top-1.5 h-0.5 w-5 bg-current transition ${
                    menuOpen ? "opacity-0" : "opacity-100"
                  }`}
                />
                <span
                  className={`absolute left-0 h-0.5 w-5 bg-current transition ${
                    menuOpen ? "top-1.5 -rotate-45" : "top-3"
                  }`}
                />
              </span>
            </button>
          </div>
        </div>

        {/* Mobile drawer */}
        {menuOpen ? (
          <div
            id="mobile-nav"
            className={`border-t md:hidden ${
              isHome
                ? "border-white/10 bg-ink/95 text-paper backdrop-blur-md"
                : "border-line bg-paper/98 text-ink backdrop-blur-md"
            }`}
          >
            <nav className="mx-auto flex max-w-6xl flex-col px-5 py-3 sm:px-8">
              {(
                [
                  // FIND_DEALS_NAV — re-enable when ready
                  // ["/deals/find", "Find deals", pathname?.startsWith("/deals/find")],
                  ["/deals", "My deals", pathname === "/deals"],
                  ["/team", "Team", pathname === "/team"],
                  ["/pricing", "Pricing", pathname === "/pricing"],
                ] as const
              ).map(([href, label, active]) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMenuOpen(false)}
                  className={`flex min-h-12 items-center border-b text-base font-medium transition ${
                    isHome ? "border-white/10" : "border-line/70"
                  } ${
                    active
                      ? "text-signal"
                      : isHome
                        ? "text-sand"
                        : "text-ink"
                  }`}
                >
                  {label}
                </Link>
              ))}
              <div className="flex min-h-12 items-center justify-between pt-1">
                {user ? (
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      void signOut();
                    }}
                    className={`text-sm font-medium ${
                      isHome ? "text-sand" : "text-muted"
                    }`}
                  >
                    Sign out
                    {user.email ? (
                      <span className="mt-0.5 block max-w-[16rem] truncate text-xs opacity-70">
                        {user.email}
                      </span>
                    ) : null}
                  </button>
                ) : loading ? (
                  <span className="text-sm opacity-50">…</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      setAuthMode("signin");
                      setAuthOpen(true);
                    }}
                    className={`text-sm font-medium ${
                      isHome ? "text-sand" : "text-muted"
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
              </div>
            </nav>
          </div>
        ) : null}
      </header>

      {/* Dim backdrop when menu open */}
      {menuOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-ink/40 md:hidden"
          aria-label="Close menu"
          onClick={() => setMenuOpen(false)}
        />
      ) : null}

      <AuthPanel
        open={authOpen}
        initialMode={authMode}
        onClose={() => setAuthOpen(false)}
      />
    </>
  );
}
