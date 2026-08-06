"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function SiteHeader() {
  const pathname = usePathname();
  const isHome = pathname === "/";

  return (
    <header
      className={`print:hidden fixed inset-x-0 top-0 z-50 transition-colors ${
        isHome
          ? "border-b border-white/10 bg-ink/25 text-paper backdrop-blur-md"
          : "border-b border-line/90 bg-paper/92 text-ink backdrop-blur-md"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
        <Link href="/" className="group flex items-baseline gap-2">
          <span className="font-display text-2xl tracking-tight transition group-hover:opacity-90">
            Estate
          </span>
          <span
            className={`hidden text-[10px] font-semibold uppercase tracking-[0.28em] sm:inline ${
              isHome ? "text-sand/70" : "text-muted"
            }`}
          >
            Studio
          </span>
        </Link>
        <nav className="flex items-center gap-3 sm:gap-5">
          <Link
            href="/deals/find"
            className={`text-sm font-medium transition ${
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
  );
}
