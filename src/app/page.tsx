import Link from "next/link";

const pillars = [
  {
    label: "01",
    title: "Deal Finder",
    href: "/deals",
    copy: "Pinpoint where build cost still clears your margin for single-family, duplex–fourplex, townhomes, and multifamily in Houston.",
    features: [
      {
        name: "Residential",
        href: "/deals",
        detail: "SF for-sale, BTR, 2–4 unit, townhome",
      },
      {
        name: "Multifamily",
        href: "/deals",
        detail: "Garden and mid-rise apartment product",
      },
    ],
  },
  {
    label: "02",
    title: "Plan & Design",
    href: "/plan",
    copy: "Screen parcels, generate multifamily floor plates or feed SF rebuild cost, and underwrite flip/rent returns with regional construction data.",
    features: [
      {
        name: "Site Screening",
        href: "/plan/screening",
        detail: "Property records, setbacks, zoning",
      },
      {
        name: "Generative Design",
        href: "/plan/generative",
        detail: "Multifamily unit mix & floor plates",
      },
      {
        name: "Cost Modeling",
        href: "/plan/cost",
        detail: "SF rehab to multifamily budgets + ROI",
      },
    ],
  },
  {
    label: "03",
    title: "Execution & Management",
    href: "/execution",
    copy: "Review purchase agreements, titles, and environmental reports. Track progress and keep schedules under control through delivery.",
    features: [
      {
        name: "Document Review",
        href: "/execution/documents",
        detail: "Upload + AI checks on agreements & titles",
      },
      {
        name: "Progress & Schedule",
        href: "/execution/progress",
        detail: "Tracking and schedule control",
      },
    ],
  },
];

export default function HomePage() {
  return (
    <>
      <section className="relative min-h-[calc(100vh-4rem)] overflow-hidden bg-ink text-paper">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage:
              "url('https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=2400&q=80')",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-ink via-ink/88 to-ink/45" />
        <div className="absolute inset-0 hero-grid opacity-40" />
        <div className="absolute inset-0 texture-grain opacity-50" />

        <div className="relative mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl flex-col justify-end px-5 pb-16 pt-28 sm:px-8 sm:pb-20 lg:justify-center lg:pb-0">
          <p className="animate-rise font-display text-5xl tracking-tight sm:text-7xl lg:text-8xl">
            Estate
          </p>
          <p className="animate-rise-delay-1 mt-3 text-[11px] font-medium uppercase tracking-[0.28em] text-sage">
            Residential · Multifamily
          </p>
          <div className="animate-draw mt-5 h-px w-24 bg-copper" />
          <h1 className="animate-rise-delay-1 mt-8 max-w-xl font-display text-2xl leading-snug text-limestone sm:text-3xl lg:text-4xl">
            Find the deal. Plan the home or apartments. Deliver on schedule.
          </h1>
          <p className="animate-rise-delay-2 mt-5 max-w-md text-base leading-relaxed text-mist sm:text-lg">
            Built for single-family, small multi, and apartment products —
            off-market land, rebuilds, and multifamily programs in Houston.
          </p>
          <div className="animate-rise-delay-3 mt-10 flex flex-wrap gap-3">
            <Link
              href="/deals"
              className="bg-copper px-6 py-3 text-sm font-medium text-paper transition hover:bg-copper-deep"
            >
              Open Deal Finder
            </Link>
            <Link
              href="/workspace"
              className="border border-paper/30 px-6 py-3 text-sm font-medium text-paper transition hover:border-paper hover:bg-paper/5"
            >
              Open workspace
            </Link>
          </div>
        </div>
      </section>

      <section className="border-b border-line bg-paper">
        <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-sage">
            From deal to delivery
          </p>
          <h2 className="mt-4 max-w-2xl font-display text-3xl tracking-tight text-ink sm:text-4xl">
            Find margin first. Then plan and execute.
          </h2>

          <div className="mt-14 grid gap-12 lg:grid-cols-3 lg:gap-10">
            {pillars.map((pillar) => (
              <article key={pillar.title} className="group">
                <div className="flex items-baseline gap-4">
                  <span className="font-mono text-sm text-copper">
                    {pillar.label}
                  </span>
                  <Link
                    href={pillar.href}
                    className="font-display text-2xl text-ink transition group-hover:text-forest sm:text-3xl"
                  >
                    {pillar.title}
                  </Link>
                </div>
                <p className="mt-4 text-base leading-relaxed text-steel">
                  {pillar.copy}
                </p>
                <ul className="mt-8 space-y-0 border-t border-line">
                  {pillar.features.map((feature) => (
                    <li key={feature.href} className="border-b border-line">
                      <Link
                        href={feature.href}
                        className="flex items-baseline justify-between gap-4 py-4 transition hover:pl-2"
                      >
                        <span>
                          <span className="block font-medium text-ink">
                            {feature.name}
                          </span>
                          <span className="mt-1 block text-sm text-steel">
                            {feature.detail}
                          </span>
                        </span>
                        <span className="text-copper" aria-hidden>
                          →
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-forest text-paper">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-8 px-5 py-20 sm:px-8 sm:py-24 md:flex-row md:items-end md:justify-between">
          <div className="max-w-xl">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-sage">
              Your projects, one workspace
            </p>
            <h2 className="mt-4 font-display text-3xl tracking-tight sm:text-4xl">
              Open a project, underwrite a deal, upload diligence, and track the
              schedule — no account required.
            </h2>
          </div>
          <Link
            href="/workspace"
            className="bg-copper px-6 py-3 text-sm font-medium text-paper transition hover:bg-copper-deep"
          >
            Get started free
          </Link>
        </div>
      </section>
    </>
  );
}
