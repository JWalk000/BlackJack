import Link from "next/link";

const HERO_IMG =
  "https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=2400&q=80";

const YARD_IMG =
  "https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=1800&q=80";

const MARQUEE = [
  "Ground-up",
  "Rehab",
  "Residential",
  "Commercial",
  "Itemized costs",
  "Flip math",
  "Hold & rent",
  "Line by line",
];

export default function HomePage() {
  return (
    <>
      {/* Full-bleed hero · one composition */}
      <section className="relative min-h-[100svh] overflow-hidden bg-ink text-paper">
        <div className="absolute inset-0 overflow-hidden">
          <div
            className="animate-ken absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url('${HERO_IMG}')` }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/70 to-ink/35" />
          <div className="absolute inset-0 bg-gradient-to-r from-ink/90 via-ink/50 to-transparent" />
          <div className="texture-grain absolute inset-0 opacity-40" />
        </div>

        <div className="relative mx-auto flex min-h-[100svh] max-w-6xl flex-col justify-end px-5 pb-28 pt-28 sm:px-8 sm:pb-32 lg:justify-center lg:pb-24">
          <p className="animate-rise text-[11px] font-medium uppercase tracking-[0.32em] text-signal">
            Build the deal file
          </p>

          <h1 className="animate-rise-1 mt-3 font-display text-[clamp(4.5rem,18vw,10rem)] leading-[0.88] tracking-tight text-paper">
            Estate
          </h1>

          <div className="animate-draw mt-5 h-1 w-28 origin-left bg-signal sm:w-36" />

          <p className="animate-rise-2 mt-7 max-w-md text-lg leading-relaxed text-sand sm:text-xl">
            Ground-up or rehab. Residential or commercial. Every cost broken
            down — then the returns pop.
          </p>

          <div className="animate-rise-3 mt-10 flex flex-wrap items-center gap-3">
            <Link
              href="/deals/new"
              className="bg-signal px-7 py-3.5 text-sm font-semibold tracking-wide text-paper transition hover:bg-brass hover:text-ink"
            >
              Start a deal
            </Link>
            <Link
              href="/deals"
              className="border border-paper/40 px-7 py-3.5 text-sm font-medium text-paper transition hover:border-paper hover:bg-paper/10"
            >
              Open workspace
            </Link>
          </div>
        </div>

        {/* Flavor strip */}
        <div className="absolute inset-x-0 bottom-0 border-t border-white/10 bg-ink/70 py-3 backdrop-blur-sm">
          <div className="overflow-hidden">
            <div className="animate-marquee flex w-max gap-10 whitespace-nowrap px-4 text-[11px] font-medium uppercase tracking-[0.28em] text-sand/80">
              {[...MARQUEE, ...MARQUEE].map((item, i) => (
                <span key={`${item}-${i}`} className="flex items-center gap-10">
                  {item}
                  <span className="text-signal" aria-hidden>
                    ◆
                  </span>
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Secondary band — one job: how it feels to use */}
      <section className="relative overflow-hidden bg-ink text-paper">
        <div className="grid min-h-[70vh] lg:grid-cols-2">
          <div
            className="relative min-h-[40vh] bg-cover bg-center lg:min-h-full"
            style={{ backgroundImage: `url('${YARD_IMG}')` }}
          >
            <div className="absolute inset-0 bg-forest/30 mix-blend-multiply" />
            <div className="absolute inset-0 bg-gradient-to-t from-ink/60 to-transparent lg:bg-gradient-to-r" />
          </div>

          <div className="flex flex-col justify-center px-5 py-16 sm:px-10 sm:py-24 lg:px-16">
            <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-signal">
              Not a spreadsheet mood
            </p>
            <h2 className="mt-4 font-display text-4xl leading-[1.05] tracking-tight sm:text-5xl">
              Itemize hard. Final numbers loud.
            </h2>
            <p className="mt-5 max-w-md text-base leading-relaxed text-sand/85">
              Demo, structure, MEP, finishes, soft costs — line them out, then
              flip or hold against real all-in capital. One deal. Your numbers.
            </p>
            <ul className="mt-10 space-y-4 border-t border-white/15 pt-8 text-sm text-sand/90">
              <li className="flex gap-3">
                <span className="text-signal">01</span>
                Pick ground-up or rehab — residential or commercial
              </li>
              <li className="flex gap-3">
                <span className="text-signal">02</span>
                Build the budget item by item (not a vague lump sum)
              </li>
              <li className="flex gap-3">
                <span className="text-signal">03</span>
                See profit, ROI, NOI, and cash flow update live
              </li>
            </ul>
            <Link
              href="/deals/new"
              className="mt-10 inline-flex w-fit bg-paper px-6 py-3 text-sm font-semibold text-ink transition hover:bg-signal hover:text-paper"
            >
              Open a blank deal →
            </Link>
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden border-b border-line bg-stone">
        <div
          className="pointer-events-none absolute -right-20 top-0 font-display text-[clamp(8rem,28vw,18rem)] leading-none text-ink/[0.04]"
          aria-hidden
        >
          $
        </div>
        <div className="relative mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
          <div className="max-w-2xl">
            <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-signal">
              Ready when you are
            </p>
            <h2 className="mt-4 font-display text-4xl tracking-tight text-ink sm:text-5xl">
              Start rough. Tighten the numbers as you go.
            </h2>
            <p className="mt-4 text-base leading-relaxed text-muted">
              Deals live in this browser for now — no account wall. Come back,
              tweak costs, re-run the exit.
            </p>
          </div>
          <div className="mt-12 flex flex-wrap gap-3">
            <Link href="/deals/new" className="btn-signal">
              New deal
            </Link>
            <Link href="/deals/find" className="btn-ghost">
              Find deals
            </Link>
            <Link href="/deals" className="btn-ghost">
              My deals
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
