"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export function WorkspaceShell({
  children,
  projectId,
  projectName,
}: {
  children: React.ReactNode;
  projectId?: string;
  projectName?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { session, signOut } = useAuth();

  const projectLinks = projectId
    ? [
        { href: `/workspace/${projectId}`, label: "Overview", exact: true },
        { href: `/workspace/${projectId}/analysis`, label: "Property & cost" },
        { href: `/workspace/${projectId}/documents`, label: "Documents" },
        { href: `/workspace/${projectId}/progress`, label: "Schedule" },
        { href: `/workspace/${projectId}/tools`, label: "Plan tools" },
      ]
    : [];

  function isActive(href: string, exact?: boolean) {
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  }

  return (
    <div className="min-h-screen bg-paper">
      <div className="flex min-h-screen">
        <aside className="hidden w-60 shrink-0 flex-col border-r border-line bg-ink text-paper md:flex">
          <div className="border-b border-white/10 px-5 py-5">
            <Link href="/" className="font-display text-2xl tracking-tight">
              Estate
            </Link>
            <p className="mt-1 text-[10px] uppercase tracking-[0.2em] text-sage">
              Workspace
            </p>
          </div>

          <nav className="flex-1 space-y-1 px-3 py-4">
            <Link
              href="/workspace"
              className={`block px-3 py-2 text-sm transition ${
                pathname === "/workspace"
                  ? "bg-white/10 text-paper"
                  : "text-mist hover:bg-white/5"
              }`}
            >
              Projects
            </Link>
            <Link
              href="/workspace/deals"
              className={`block px-3 py-2 text-sm transition ${
                pathname.startsWith("/workspace/deals")
                  ? "bg-white/10 text-paper"
                  : "text-mist hover:bg-white/5"
              }`}
            >
              Deal Finder
            </Link>
            <Link
              href={session ? "/workspace/account" : "/login?next=/workspace"}
              className={`block px-3 py-2 text-sm transition ${
                pathname.startsWith("/workspace/account")
                  ? "bg-white/10 text-paper"
                  : "text-mist hover:bg-white/5"
              }`}
            >
              {session ? "Account" : "Sign in (optional)"}
            </Link>

            {projectLinks.length > 0 && (
              <div className="mt-6">
                <p className="truncate px-3 text-[10px] font-medium uppercase tracking-[0.18em] text-sage">
                  {projectName ?? "Project"}
                </p>
                <div className="mt-2 space-y-1">
                  {projectLinks.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={`block px-3 py-2 text-sm transition ${
                        isActive(link.href, link.exact)
                          ? "bg-white/10 text-paper"
                          : "text-mist hover:bg-white/5"
                      }`}
                    >
                      {link.label}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </nav>

          <div className="border-t border-white/10 px-5 py-4">
            {session ? (
              <>
                <p className="truncate text-sm text-paper">{session.name}</p>
                <p className="truncate text-xs text-sage">{session.email}</p>
                <div className="mt-3 flex flex-wrap gap-3 text-xs">
                  <Link
                    href="/workspace/account"
                    className="text-mist underline-offset-2 hover:underline"
                  >
                    Account
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      signOut();
                      router.push("/");
                    }}
                    className="text-mist underline-offset-2 hover:underline"
                  >
                    Sign out
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-paper">Browsing as guest</p>
                <p className="mt-1 text-xs text-sage">
                  No account needed. Sign in only to keep work by email.
                </p>
                <div className="mt-3 flex flex-wrap gap-3 text-xs">
                  <Link
                    href="/login?next=/workspace"
                    className="text-mist underline-offset-2 hover:underline"
                  >
                    Sign in
                  </Link>
                  <Link
                    href="/signup?next=/workspace"
                    className="text-mist underline-offset-2 hover:underline"
                  >
                    Create account
                  </Link>
                </div>
              </>
            )}
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-14 items-center justify-between border-b border-line bg-paper px-4 sm:px-6 md:hidden">
            <Link href="/workspace" className="font-display text-xl">
              Estate
            </Link>
            {session ? (
              <button
                type="button"
                className="text-sm text-steel"
                onClick={() => {
                  signOut();
                  router.push("/");
                }}
              >
                Sign out
              </button>
            ) : (
              <Link href="/login?next=/workspace" className="text-sm text-steel">
                Sign in
              </Link>
            )}
          </header>

          {projectId && (
            <div className="flex gap-1 overflow-x-auto border-b border-line bg-limestone px-3 py-2 md:hidden">
              {projectLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`shrink-0 px-3 py-1.5 text-xs font-medium ${
                    isActive(link.href, link.exact)
                      ? "bg-ink text-paper"
                      : "text-steel"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          )}

          <div className="flex-1">{children}</div>
        </div>
      </div>
    </div>
  );
}
