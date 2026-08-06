"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/context/AuthContext";

const marketingNav = [
  {
    label: "Deal Finder",
    href: "/deals",
    children: [{ label: "Houston", href: "/deals" }],
  },
  {
    label: "Plan & Design",
    href: "/plan",
    children: [
      { label: "Site Screening", href: "/plan/screening" },
      { label: "Generative Design", href: "/plan/generative" },
      { label: "Cost Modeling", href: "/plan/cost" },
    ],
  },
  {
    label: "Execution",
    href: "/execution",
    children: [
      { label: "Document Review", href: "/execution/documents" },
      { label: "Progress & Schedule", href: "/execution/progress" },
    ],
  },
];

export function SiteHeader() {
  const pathname = usePathname();
  const { session, signOut, ready } = useAuth();
  const [open, setOpen] = useState(false);
  const isHome = pathname === "/";
  const inWorkspace = pathname.startsWith("/workspace");
  const isAuthPage = pathname === "/login" || pathname === "/signup";

  if (inWorkspace) return null;

  return (
    <header
      className={`sticky top-0 z-50 border-b transition-colors ${
        isHome
          ? "border-white/10 bg-ink/80 text-paper backdrop-blur-md"
          : "border-line bg-paper/90 text-ink backdrop-blur-md"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
        <Link
          href="/"
          className="flex items-baseline gap-2"
          onClick={() => setOpen(false)}
        >
          <span className="font-display text-2xl tracking-tight">Estate</span>
          <span
            className={`hidden text-[10px] font-medium uppercase tracking-[0.22em] sm:inline ${
              isHome ? "text-sage" : "text-sage"
            }`}
          >
            Develop
          </span>
        </Link>

        {!isAuthPage && (
          <nav className="hidden items-center gap-8 md:flex">
            {marketingNav.map((item) => (
              <div key={item.href} className="group relative">
                <Link
                  href={item.href}
                  className={`text-sm tracking-wide transition-opacity hover:opacity-70 ${
                    pathname.startsWith(item.href) ? "opacity-100" : "opacity-80"
                  }`}
                >
                  {item.label}
                </Link>
                <div className="invisible absolute left-1/2 top-full z-50 pt-3 opacity-0 transition group-hover:visible group-hover:opacity-100">
                  <div
                    className={`min-w-48 -translate-x-1/2 border px-1 py-2 shadow-lg ${
                      isHome
                        ? "border-white/10 bg-forest text-paper"
                        : "border-line bg-paper text-ink"
                    }`}
                  >
                    {item.children.map((child) => (
                      <Link
                        key={child.label}
                        href={child.href}
                        className="block px-3 py-2 text-sm opacity-80 transition hover:opacity-100"
                      >
                        {child.label}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            ))}

            {ready && session ? (
              <>
                <Link
                  href="/workspace"
                  className={`text-sm transition-opacity hover:opacity-70 ${
                    pathname.startsWith("/workspace") ? "opacity-100" : "opacity-80"
                  }`}
                >
                  Workspace
                </Link>
                <button
                  type="button"
                  onClick={signOut}
                  className="text-sm opacity-70 transition hover:opacity-100"
                >
                  Sign out
                </button>
                <Link
                  href="/workspace"
                  className={`ml-1 px-4 py-2 text-sm font-medium transition ${
                    isHome
                      ? "bg-copper text-paper hover:bg-copper-deep"
                      : "bg-ink text-paper hover:bg-forest"
                  }`}
                >
                  Open projects
                </Link>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="text-sm opacity-80 transition hover:opacity-100"
                >
                  Sign in
                </Link>
                <Link
                  href="/workspace"
                  className={`ml-1 px-4 py-2 text-sm font-medium transition ${
                    isHome
                      ? "bg-copper text-paper hover:bg-copper-deep"
                      : "bg-ink text-paper hover:bg-forest"
                  }`}
                >
                  Open workspace
                </Link>
              </>
            )}
          </nav>
        )}

        {!isAuthPage && (
          <button
            type="button"
            className="md:hidden"
            aria-label="Toggle menu"
            onClick={() => setOpen((v) => !v)}
          >
            <span className="block h-0.5 w-6 bg-current" />
            <span className="mt-1.5 block h-0.5 w-6 bg-current" />
          </button>
        )}
      </div>

      {open && !isAuthPage && (
        <div
          className={`border-t px-5 py-4 md:hidden ${
            isHome ? "border-white/10 bg-ink text-paper" : "border-line bg-paper"
          }`}
        >
          {marketingNav.map((item) => (
            <div key={item.href} className="mb-4">
              <Link
                href={item.href}
                className="font-medium"
                onClick={() => setOpen(false)}
              >
                {item.label}
              </Link>
              <div className="mt-2 space-y-2 pl-3">
                {item.children.map((child) => (
                  <Link
                    key={child.label}
                    href={child.href}
                    className="block text-sm opacity-75"
                    onClick={() => setOpen(false)}
                  >
                    {child.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
          <div className="mt-4 space-y-3 border-t border-current/10 pt-4">
            {session ? (
              <>
                <Link href="/workspace" onClick={() => setOpen(false)}>
                  Workspace
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    signOut();
                    setOpen(false);
                  }}
                >
                  Sign out
                </button>
              </>
            ) : (
              <>
                <Link href="/workspace" onClick={() => setOpen(false)}>
                  Open workspace
                </Link>
                <Link href="/login" onClick={() => setOpen(false)}>
                  Sign in (optional)
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
