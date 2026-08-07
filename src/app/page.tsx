import Link from "next/link";
import {
  PRO_PRICE_USD_MONTHLY,
  TEAM_PRICE_USD_MONTHLY,
} from "@/lib/billing/plans";

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
  "Sell math",
  "Hold & rent",
  "Line by line",
];

function PricingSticker({
  variant,
}: {
  variant: "pro" | "team";
}) {
  const isPro = variant === "pro";
  const price = isPro ? PRO_PRICE_USD_MONTHLY : TEAM_PRICE_USD_MONTHLY;
  const label = isPro ? "Pro" : "Team";
  const cta = isPro ? "Get Pro →" : "Team details →";
  const line = isPro
    ? "Unlimited deals · cloud sync · bank packages"
    : "5 seats · shared deals · owner invites";
  const href = isPro ? "/pricing" : "/team";

  return (
    <div className="relative w-[min(100%,10rem)] shrink-0 pb-2 pt-1 min-[380px]:w-[min(100%,11.25rem)] sm:w-[12.25rem]">
      <div
        className={`sticker-pro relative z-10 px-3 pb-2.5 pt-3.5 min-[380px]:px-3.5 min-[380px]:pb-3 min-[380px]:pt-4 sm:px-3.5 sm:pb-3.5 sm:pt-5 ${
          isPro ? "" : "sticker-team"
        }`}
      >
        <span className="sticker-tape" aria-hidden />
        <div className="relative z-[1]">
          <span className="sticker-badge">{label}</span>
          <p className="mt-1.5 font-display text-[1.95rem] leading-[0.85] tracking-tight text-ink min-[380px]:text-[2.2rem] sm:text-[2.45rem]">
            ${price}
            <span className="ml-0.5 align-baseline font-body text-xs font-semibold tracking-normal text-muted sm:text-sm">
              /mo
            </span>
          </p>
          <p className="mt-1.5 border-t border-ink/10 pt-1.5 text-[10px] leading-snug text-ink/75 min-[380px]:text-[11px]">
            {line}
          </p>
          <Link
            href={href}
            className={`mt-2.5 inline-flex min-h-10 w-full items-center justify-center px-3 py-2 text-xs font-semibold shadow-[0_2px_0_0] shadow-ink/15 transition sm:text-sm ${
              isPro
                ? "bg-signal text-paper hover:bg-brass hover:text-ink hover:shadow-ink/10"
                : "bg-forest text-paper hover:bg-canopy hover:shadow-ink/10"
            }`}
          >
            {cta}
          </Link>
        </div>
      </div>
    </div>
  );
}

/** Pro + Team side by side — same sticky-note cluster. */
function StickerStack() {
  return (
    <div
      className="sticker-pair flex flex-row flex-wrap items-start justify-center gap-2 sm:gap-3 lg:justify-end"
      aria-label="Pro and Team pricing"
    >
      <PricingSticker variant="pro" />
      <PricingSticker variant="team" />
    </div>
  );
}

export default function HomePage() {
  return (
    <>
      {/* Full-bleed hero · one composition + pricing stickers */}
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

        <div className="relative mx-auto flex min-h-[100svh] max-w-6xl flex-col justify-end px-5 pb-28 pt-20 sm:px-8 sm:pb-36 sm:pt-24 lg:justify-center lg:pb-32 lg:pt-16">
          <div className="grid items-end gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(24rem,28rem)] lg:items-center lg:gap-8 xl:gap-10">
            <div className="min-w-0 lg:-translate-y-6">
              <p className="animate-rise text-[11px] font-medium uppercase tracking-[0.32em] text-signal">
                Build for the Future
              </p>

              <h1 className="animate-rise-1 mt-2 font-display text-[clamp(3.75rem,16vw,10rem)] leading-[0.88] tracking-tight text-paper">
                Estate
              </h1>

              <div className="animate-draw mt-3.5 h-1 w-28 origin-left bg-signal sm:w-36" />

              <p className="animate-rise-2 mt-4 max-w-md text-base leading-relaxed text-sand sm:mt-5 sm:text-xl">
                Ground-up or rehab. Residential or commercial. Every cost broken
                down — then the returns pop.
              </p>

              <div className="animate-rise-3 mt-6 flex w-full max-w-md flex-col items-stretch gap-2.5 sm:mt-7 sm:max-w-none sm:items-start">
                <Link
                  href="/deals/new"
                  className="inline-flex min-h-14 w-full items-center justify-center bg-signal px-8 py-4 text-base font-semibold tracking-wide text-paper transition hover:bg-brass hover:text-ink sm:w-auto sm:min-h-[3.75rem] sm:px-10 sm:text-lg"
                >
                  Develop the numbers
                </Link>
                <p className="max-w-sm text-[12px] leading-snug tracking-wide text-sand/70 sm:text-[13px]">
                  Property · itemized costs · final numbers · bank package
                </p>
                <Link
                  href="/deals"
                  className="inline-flex min-h-10 w-fit items-center text-sm font-medium text-sand/85 underline-offset-4 transition hover:text-paper hover:underline"
                >
                  My deals
                </Link>
              </div>

              {/* Mobile / tablet: Pro + Team under CTAs */}
              <div className="animate-rise-3 mt-8 lg:hidden">
                <StickerStack />
              </div>
            </div>

            {/* Desktop: Pro + Team tags side by side on the right */}
            <div className="animate-rise-2 hidden justify-self-end lg:block">
              <StickerStack />
            </div>
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
              sell or hold against real all-in capital. One deal. Your numbers.
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

      <section
        id="pricing"
        className="relative border-b border-line bg-stone"
      >
        <div className="relative mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
          <div className="max-w-2xl">
            <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-signal">
              Ready when you are
            </p>
            <h2 className="mt-4 font-display text-4xl tracking-tight text-ink sm:text-5xl">
              Start rough. Tighten the numbers as you go.
            </h2>
            <p className="mt-4 text-base leading-relaxed text-muted">
              Free keeps deals in this browser. Pro syncs to the cloud. Team
              shares deals across five seats.
            </p>
          </div>
          <div className="mt-12 flex flex-col items-stretch gap-4 sm:items-start">
            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
              <Link
                href="/deals/new"
                className="btn-signal w-full sm:w-auto"
              >
                New deal
              </Link>
              <Link href="/deals" className="btn-ghost w-full sm:w-auto">
                My deals
              </Link>
            </div>
            <Link
              href="/pricing"
              className="inline-flex min-h-11 items-center text-sm font-medium text-muted transition hover:text-ink"
            >
              See pricing →
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
