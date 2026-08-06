"use client";

import Link from "next/link";

export function AuthShell({
  eyebrow,
  title,
  subtitle,
  children,
  footer,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <div className="min-h-[calc(100vh-4rem)] bg-limestone">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl lg:grid-cols-2">
        <div className="relative hidden overflow-hidden bg-ink px-10 py-16 text-paper lg:flex lg:flex-col lg:justify-between">
          <div>
            <Link href="/" className="font-display text-3xl tracking-tight">
              Estate
            </Link>
            <p className="mt-2 text-[10px] font-medium uppercase tracking-[0.22em] text-sage">
              Develop
            </p>
          </div>
          <div>
            <h2 className="font-display text-4xl leading-tight">
              Find the deal.
              <br />
              Plan the build.
            </h2>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-mist">
              Your account keeps Houston deals, underwriting, and project
              planning on this device — ready when you sit down to work.
            </p>
          </div>
          <p className="text-xs text-sage">
            Signed-in access · project workspace · deal handoff
          </p>
        </div>

        <div className="flex flex-col justify-center px-5 py-14 sm:px-10 lg:px-14">
          <Link
            href="/"
            className="mb-10 font-display text-2xl text-ink lg:hidden"
          >
            Estate
          </Link>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-sage">
            {eyebrow}
          </p>
          <h1 className="mt-3 font-display text-4xl text-ink">{title}</h1>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-steel">
            {subtitle}
          </p>
          <div className="mt-10 max-w-md">{children}</div>
          <div className="mt-8 max-w-md text-sm text-steel">{footer}</div>
        </div>
      </div>
    </div>
  );
}

export const authFieldClass =
  "mt-2 w-full border border-line bg-paper px-4 py-3 text-sm outline-none ring-copper focus:ring-1";

export const authLabelClass =
  "text-xs font-medium uppercase tracking-[0.16em] text-sage";
