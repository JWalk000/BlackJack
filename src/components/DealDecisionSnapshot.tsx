"use client";

import Link from "next/link";
import type { Deal } from "@/lib/types";
import { summarizeBudget, verdictForDeal } from "@/lib/budget";
import { money, pct, underwrite } from "@/lib/underwriting";

/**
 * Decision snapshot — lives on Final numbers, mirrored in bank package.
 * Keep go/no-go + key $ in one place so the app does not feel scattered.
 */
export function DealDecisionSnapshot({
  deal,
  packageHref,
}: {
  deal: Deal;
  packageHref: string;
}) {
  const result = underwrite(deal);
  const budget = summarizeBudget(deal);
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
      className={`border p-5 sm:p-6 ${toneRing}`}
      aria-label="Deal decision snapshot"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="page-label">Decision</p>
          <div className="mt-2 flex flex-wrap items-baseline gap-3">
            <h2 className={`font-display text-3xl tracking-tight sm:text-4xl ${toneText}`}>
              {verdict.label}
            </h2>
            <p className="max-w-xl text-sm text-muted">{verdict.detail}</p>
          </div>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <Link href={packageHref} className="btn-signal w-full sm:w-auto">
            Bank package
          </Link>
          <Link
            href={`${packageHref}?print=1`}
            className="btn-ghost w-full sm:w-auto"
          >
            Print decision package
          </Link>
        </div>
      </div>

      <dl className="mt-6 grid gap-px border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
        <Snap
          label="Exit value (ARV)"
          value={money(deal.assumptions.arv)}
        />
        <Snap label="All-in cost" value={money(result.totalAllIn)} />
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
        <Snap
          label="Budget vs spent"
          value={
            budget.budgetSet
              ? `${money(budget.spent)} / ${money(budget.costBudget)}`
              : `${money(budget.spent)} · no cap`
          }
          tone={
            budget.status === "over"
              ? "loss"
              : budget.status === "into_contingency"
                ? "signal"
                : undefined
          }
        />
      </dl>

      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted">
        <span>Cash required {money(result.cashRequired)}</span>
        <span>% of ARV {pct(result.pctOfArv)}</span>
        {budget.contingencyPct > 0 ? (
          <span>
            Contingency {budget.contingencyPct}% ({money(budget.contingencyDollars)})
          </span>
        ) : null}
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
  return (
    <div className="bg-paper px-4 py-3">
      <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
        {label}
      </dt>
      <dd
        className={`mt-1 font-display text-xl tracking-tight ${
          tone === "profit"
            ? "text-profit"
            : tone === "loss"
              ? "text-loss"
              : tone === "signal"
                ? "text-signal"
                : "text-ink"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
