import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-ink text-paper">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 sm:px-8 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <p className="font-display text-3xl">Estate</p>
          <p className="mt-1 text-[10px] uppercase tracking-[0.22em] text-sage">
            Residential · Multifamily
          </p>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-mist">
            Find, underwrite, and deliver single-family and multifamily deals —
            not a commercial-office platform.
          </p>
          <Link
            href="/workspace"
            className="mt-5 inline-block text-sm text-copper hover:text-paper"
          >
            Open workspace →
          </Link>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-sage">
            Deals
          </p>
          <ul className="mt-4 space-y-2 text-sm text-mist">
            <li>
              <Link href="/deals" className="hover:text-paper">
                Deal Finder
              </Link>
            </li>
            <li>
              <Link href="/workspace/deals" className="hover:text-paper">
                Workspace deals
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-sage">
            Plan & Design
          </p>
          <ul className="mt-4 space-y-2 text-sm text-mist">
            <li>
              <Link href="/plan/screening" className="hover:text-paper">
                Site Screening
              </Link>
            </li>
            <li>
              <Link href="/plan/generative" className="hover:text-paper">
                Generative Design
              </Link>
            </li>
            <li>
              <Link href="/plan/cost" className="hover:text-paper">
                Cost Modeling
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-sage">
            Execution
          </p>
          <ul className="mt-4 space-y-2 text-sm text-mist">
            <li>
              <Link href="/execution/documents" className="hover:text-paper">
                Document Review
              </Link>
            </li>
            <li>
              <Link href="/execution/progress" className="hover:text-paper">
                Progress & Schedule
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10 px-5 py-5 text-center text-xs text-sage sm:px-8">
        © {new Date().getFullYear()} Estate. Built for development teams.
      </div>
    </footer>
  );
}
