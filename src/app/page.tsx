import Link from "next/link";
import {
  PRO_PRICE_USD_MONTHLY,
  TEAM_PRICE_USD_MONTHLY,
} from "@/lib/billing/plans";
import { BrandMark } from "@/components/BrandMark";
import { BRAND_NAME } from "@/lib/brand";

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

const SPECS = ["Ground-up", "Rehab", "Residential", "Commercial"];

const PIPELINE = ["Property", "Itemized costs", "Final numbers", "Bank package"];

const [brandLead, brandArc] = BRAND_NAME.split(" ");

function PricingSticker({
  variant,
}: {
  variant: "free" | "pro" | "team";
}) {
  const isFree = variant === "free";
  const copy = {
    free: {
      label: "Free",
      price: "Try",
      suffix: "for free",
      line: "No card · start a deal now",
      cta: "Try for free →",
      href: "/deals/new",
      stickerClass: "sticker-free",
      ctaClass:
        "bg-ink text-paper hover:bg-forest hover:shadow-ink/10",
    },
    pro: {
      label: "Pro",
      price: `$${PRO_PRICE_USD_MONTHLY}`,
      suffix: "/mo",
      line: "Unlimited deals · cloud sync · bank packages",
      cta: "Get Pro →",
      href: "/pricing",
      stickerClass: "",
      ctaClass:
        "bg-signal text-paper hover:bg-brass hover:text-ink hover:shadow-ink/10",
    },
    team: {
      label: "Team",
      price: `$${TEAM_PRICE_USD_MONTHLY}`,
      suffix: "/mo",
      line: "5 seats · shared deals · owner invites",
      cta: "Team details →",
      href: "/team",
      stickerClass: "sticker-team",
      ctaClass:
        "bg-forest text-paper hover:bg-canopy hover:shadow-ink/10",
    },
  }[variant];

  return (
    <div
      className={`relative shrink-0 pb-2 pt-3 ${
        isFree
          ? "w-full max-w-[17rem] sm:w-[13.5rem] sm:max-w-none"
          : "w-[calc(50%-0.25rem)] min-w-0 max-w-[11.5rem] sm:w-[12.25rem] sm:max-w-none"
      }`}
    >
      <div
        className={`sticker-pro relative z-10 px-2.5 pb-2.5 pt-3 min-[400px]:px-3 min-[400px]:pt-3.5 sm:px-3.5 sm:pb-3.5 sm:pt-5 ${copy.stickerClass}`}
      >
        <span className="sticker-tape" aria-hidden />
        <div className="relative z-[1]">
          <span className="sticker-badge">{copy.label}</span>
          <p className="mt-1.5 font-display text-[1.7rem] leading-[0.85] tracking-tight text-ink min-[400px]:text-[1.95rem] sm:text-[2.45rem]">
            {copy.price}
            <span className="ml-0.5 align-baseline font-body text-[11px] font-semibold tracking-normal text-muted sm:text-sm">
              {copy.suffix}
            </span>
          </p>
          <p className="mt-1.5 border-t border-ink/10 pt-1.5 text-[10px] leading-snug text-ink/75 sm:text-[11px]">
            {copy.line}
          </p>
          <Link
            href={copy.href}
            className={`mt-2 inline-flex min-h-11 w-full items-center justify-center px-2 py-2 text-xs font-semibold shadow-[0_2px_0_0] shadow-ink/15 transition sm:mt-2.5 sm:px-3 sm:text-sm ${copy.ctaClass}`}
          >
            {copy.cta}
          </Link>
        </div>
      </div>
    </div>
  );
}

/** Try for free centered over Pro + Team (pyramid). */
function StickerStack() {
  return (
    <div
      className="sticker-pair flex w-full flex-col items-center gap-1.5 sm:gap-3 lg:w-auto"
      aria-label="Try for free, Pro, and Team"
    >
      <PricingSticker variant="free" />
      <div className="flex w-full max-w-[24rem] flex-row items-start justify-center gap-2 sm:w-auto sm:max-w-none sm:gap-3">
        <PricingSticker variant="pro" />
        <PricingSticker variant="team" />
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <>
      {/* Full-bleed hero · one composition + pricing stickers */}
      <section className="relative min-h-[100svh] overflow-x-hidden bg-ink text-paper">
        <div className="absolute inset-0 overflow-hidden">
          <div
            className="animate-ken absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url('${HERO_IMG}')` }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/55 to-ink/20" />
          <div className="absolute inset-0 bg-gradient-to-r from-ink/80 via-ink/40 to-transparent" />
          <div className="hero-grid absolute inset-0" />
          <div className="texture-grain absolute inset-0 opacity-35" />
        </div>

        {/* Drafting registration marks */}
        <div
          className="pointer-events-none absolute inset-x-4 top-20 bottom-16 sm:inset-x-6 sm:top-[4.75rem] sm:bottom-[3.75rem]"
          aria-hidden
        >
          <span className="absolute left-0 top-0 h-7 w-7 border-l border-t border-paper/35 sm:h-9 sm:w-9" />
          <span className="absolute right-0 top-0 h-7 w-7 border-r border-t border-paper/35 sm:h-9 sm:w-9" />
          <span className="absolute bottom-0 left-0 h-7 w-7 border-b border-l border-paper/35 sm:h-9 sm:w-9" />
          <span className="absolute bottom-0 right-0 h-7 w-7 border-b border-r border-paper/35 sm:h-9 sm:w-9" />
        </div>

        <p
          className="pointer-events-none absolute left-4 top-1/2 hidden origin-center -translate-y-1/2 -rotate-90 text-[10px] font-medium uppercase tracking-[0.42em] text-sand/40 xl:block"
          aria-hidden
        >
          Sheet 01 · Site
        </p>

        <div className="relative mx-auto flex min-h-[100svh] max-w-6xl flex-col justify-start px-5 pb-24 pt-24 sm:px-8 sm:pb-28 sm:pt-24 lg:justify-center lg:pb-32 lg:pt-16">
          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(22rem,28rem)] lg:items-center lg:gap-8 xl:gap-10">
            <div className="min-w-0 lg:-translate-y-6">
              <div className="animate-rise flex items-center gap-3">
                <BrandMark className="h-8 w-8 shrink-0 text-paper sm:h-9 sm:w-9" />
                <p className="text-[11px] font-medium uppercase tracking-[0.32em] text-signal">
                  Build for the Future
                </p>
                <span className="hidden h-px w-10 bg-signal/80 sm:block" aria-hidden />
              </div>

              <h1 className="animate-rise-1 mt-3 font-display text-[clamp(2.75rem,12vw,7.5rem)] leading-[0.86] tracking-tight text-paper sm:mt-4 sm:text-[clamp(3.25rem,14vw,8.5rem)]">
                <span className="block">{brandLead}</span>
                <span className="relative inline-block italic text-sand">
                  {brandArc}
                  <svg
                    className="pointer-events-none absolute -bottom-[0.08em] left-[-3%] h-[0.36em] w-[108%] text-signal"
                    viewBox="0 0 100 18"
                    fill="none"
                    aria-hidden
                  >
                    <path
                      d="M3 5 C 28 18, 72 18, 97 5"
                      stroke="currentColor"
                      strokeWidth="3.4"
                      strokeLinecap="round"
                      pathLength="1"
                      className="animate-arc-stroke"
                    />
                  </svg>
                </span>
              </h1>

              <div
                className="animate-draw mt-5 flex max-w-[13rem] items-center gap-2 text-signal sm:mt-6 sm:max-w-[16rem]"
                aria-hidden
              >
                <span className="h-3 w-px bg-current" />
                <span className="h-px flex-1 bg-current" />
                <span className="text-[9px] font-medium uppercase tracking-[0.22em] text-sand/55">
                  Returns
                </span>
                <span className="h-px flex-1 bg-current" />
                <span className="h-3 w-px bg-current" />
              </div>

              <p className="animate-rise-2 mt-4 max-w-md text-base leading-relaxed text-sand sm:mt-5 sm:text-xl">
                Ground-up or rehab. Residential or commercial. Every cost broken
                down — then the returns pop.
              </p>

              <div className="animate-rise-2 mt-4 flex flex-wrap gap-2">
                {SPECS.map((tag) => (
                  <span
                    key={tag}
                    className="border border-paper/20 bg-paper/[0.06] px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-sand/90 backdrop-blur-[2px] sm:text-[11px]"
                  >
                    {tag}
                  </span>
                ))}
              </div>

              <div className="animate-rise-3 mt-6 flex w-full max-w-md flex-col items-stretch gap-3 sm:mt-7 sm:max-w-none sm:items-start">
                <Link
                  href="/deals/new"
                  className="group inline-flex min-h-16 w-full items-center justify-center bg-signal px-10 py-5 text-lg font-semibold tracking-wide text-paper shadow-[5px_5px_0_0] shadow-brass/80 transition hover:bg-brass hover:text-ink hover:shadow-ink/25 sm:w-auto sm:min-h-[4.25rem] sm:px-12 sm:py-6 sm:text-xl"
                >
                  Develop the numbers
                  <span
                    className="ml-3 inline-block transition-transform duration-200 group-hover:translate-x-1"
                    aria-hidden
                  >
                    →
                  </span>
                </Link>
                <ol className="flex max-w-lg flex-wrap items-center gap-x-2.5 gap-y-1 text-[12px] leading-snug tracking-wide text-sand/70 sm:text-[13px]">
                  {PIPELINE.map((step, i) => (
                    <li key={step} className="flex items-center gap-2.5">
                      {i > 0 ? (
                        <span className="text-signal/70" aria-hidden>
                          —
                        </span>
                      ) : null}
                      <span className="font-medium text-signal/90">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      {step}
                    </li>
                  ))}
                </ol>
              </div>

              {/* Mobile / tablet: stickers under CTAs, in the first screen */}
              <div className="animate-rise-3 mt-5 sm:mt-8 lg:hidden">
                <StickerStack />
              </div>
            </div>

            {/* Desktop: Try for free + Pro / Team on the right */}
            <div className="animate-rise-2 hidden justify-self-end lg:block">
              <StickerStack />
            </div>
          </div>
        </div>

        <div className="pointer-events-none absolute bottom-[3.85rem] left-6 z-[1] hidden border border-paper/20 bg-ink/55 px-3 py-2 backdrop-blur-sm xl:block" aria-hidden>
          <div className="flex items-center gap-2.5">
            <BrandMark className="h-6 w-6 text-paper" />
            <div>
              <p className="font-display text-sm leading-none tracking-tight text-paper">
                {BRAND_NAME}
              </p>
              <p className="mt-1 text-[8px] font-medium uppercase tracking-[0.22em] text-sand/50">
                A-01 · Deal worksheet · Rev 01
              </p>
            </div>
          </div>
        </div>

        {/* Flavor strip */}
        <div className="absolute inset-x-0 bottom-0 border-t border-signal/35 bg-ink/75 py-3 backdrop-blur-sm">
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
          <div className="mt-12 flex flex-col items-stretch gap-4 sm:flex-row sm:flex-wrap sm:items-center">
            <Link
              href="/deals/new"
              className="btn-signal w-full sm:w-auto"
            >
              New deal
            </Link>
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
