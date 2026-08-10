"use client";

import Link from "next/link";
import type { Deal } from "@/lib/types";
import { money, pct, underwrite } from "@/lib/underwriting";
import { verdictForDeal } from "@/lib/budget";

/**
 * Decision snapshot — Final numbers only, should render at page bottom
 * (after inputs / math / market).
 */
export function DealDecisionSnapshot({
  deal,
  packageHref,
}: {
  deal: Deal;
  packageHref: string;
}) {
  const result = underwrite(deal);
  const buildingSf =
    deal.property.buildingSf != null && deal.property.buildingSf > 0
      ? deal.property.buildingSf
      : null;
  const exitPsf =
    buildingSf && deal.assumptions.arv > 0
      ? deal.assumptions.arv / buildingSf
      : null;
  const exitPsfLabel =
    exitPsf != null && Number.isFinite(exitPsf)
      ? `$${Math.round(exitPsf).toLocaleString("en-US")}/sf`
      : "—";

  const verdict = verdictForDeal(deal, {
    exitStrategy: deal.exitStrategy,
    flipProfit: result.flipProfit,
    cashFlowMonthly: result.cashFlowMonthly,
    arv: deal.assumptions.arv,
    totalAllIn: result.totalAllIn,
  });

  const toneRing =
    verdict.tone === "profit"
      ? "border-profit/35 bg-profit/5"
      : verdict.tone === "loss"
        ? "border-loss/35 bg-[color-mix(in_srgb,var(--loss)_8%,var(--paper))]"
        : verdict.tone === "signal"
          ? "border-signal/35 bg-signal/5"
          : "border-line bg-paper";

  const toneText =
    verdict.tone === "profit"
      ? "text-profit"
      : verdict.tone === "loss"
        ? "text-loss"
        : verdict.tone === "signal"
          ? "text-signal"
          : "text-muted";

  return (
    <section
      id="decision"
      className={`border px-4 py-3 sm:px-5 sm:py-4 ${toneRing}`}
      aria-label="Deal decision snapshot"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="page-label">Decision</p>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2
              className={`font-display text-2xl tracking-tight sm:text-3xl ${toneText}`}
            >
              {verdict.label}
            </h2>
            <p className="max-w-xl text-sm text-muted">{verdict.detail}</p>
          </div>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <Link
            href={packageHref}
            className="btn-signal w-full !min-h-10 sm:w-auto"
          >
            Bank package
          </Link>
          <Link
            href={`${packageHref}?print=1`}
            className="btn-ghost w-full !min-h-10 sm:w-auto"
          >
            Print decision package
          </Link>
        </div>
      </div>

      <dl className="mt-3 grid gap-px border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
        <Snap
          label="Exit value (ARV)"
          value={money(deal.assumptions.arv)}
        />
        <Snap
          label="All-in cost"
          value={money(result.totalAllIn)}
          tone="loss"
        />
        {deal.exitStrategy === "flip" ? (
          <Snap
            label="Projected profit"
            value={money(result.flipProfit)}
            tone={result.flipProfit >= 0 ? "profit" : "loss"}
          />
        ) : (
          <Snap
            label="Cash flow / mo"
            value={money(result.cashFlowMonthly)}
            tone={result.cashFlowMonthly >= 0 ? "profit" : "loss"}
          />
        )}
        <Snap label="Exit $/sf" value={exitPsfLabel} />
      </dl>

      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted">
        <span>Cash required {money(result.cashRequired)}</span>
        <span>% of ARV {pct(result.pctOfArv)}</span>
        {deal.exitStrategy === "flip" ? (
          <span>ROI on cash {pct(result.flipRoiOnCash)}</span>
        ) : (
          <span>Cap rate on cost {pct(result.capRateOnCost)}</span>
        )}
      </div>
    </section>
  );
}

function Snap({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "profit" | "loss" | "signal";
}) {
  const valueColor =
    tone === "profit"
      ? "var(--profit)"
      : tone === "loss"
        ? "#c4281a"
        : tone === "signal"
          ? "var(--signal)"
          : "var(--ink)";

  return (
    <div className="bg-paper px-3 py-2">
      <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
        {label}
      </dt>
      <dd
        className="mt-0.5 font-display text-lg tracking-tight sm:text-xl"
        style={{ color: valueColor }}
      >
        {value}
      </dd>
    </div>
  );
}
