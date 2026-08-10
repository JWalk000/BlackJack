"use client";

import type { Deal } from "@/lib/types";
import {
  summarizeBudget,
  type BudgetStatus,
} from "@/lib/budget";
import { money } from "@/lib/underwriting";
import { Field, MoneyInput, NumberInput } from "./ui";

function statusMessage(status: BudgetStatus, remaining: number | null, overBy: number): string | null {
  switch (status) {
    case "over":
      return `Over budget by ${money(overBy)}. Trim line items or raise the deal budget.`;
    case "into_contingency":
      return "Spend is using contingency reserve. Still under budget — tighten scope if you can.";
    case "watching":
      return remaining != null
        ? `Within 10% of budget — ${money(remaining)} left before you max out.`
        : null;
    case "unset":
      return "Set a deal budget so Costs, Final numbers, and Project stay on one plan.";
    default:
      return null;
  }
}

/**
 * Unified budget strip for Costs (edit), Final numbers, and Project (read + link).
 */
export function DealBudgetStrip({
  deal,
  onChange,
  mode = "summary",
  onGoToCosts,
}: {
  deal: Deal;
  onChange?: (deal: Deal) => void;
  mode?: "edit" | "summary";
  /** When summary mode, jump to costs tab */
  onGoToCosts?: () => void;
}) {
  const b = summarizeBudget(deal);
  const overish = b.status === "over" || b.status === "into_contingency";
  const msg = statusMessage(b.status, b.remaining, b.overBy);

  return (
    <div
      className={`border px-3 py-3 sm:px-4 ${
        b.status === "over"
          ? "border-loss/40 bg-[color-mix(in_srgb,var(--loss)_8%,var(--paper))]"
          : overish
            ? "border-signal/35 bg-signal/5"
            : "border-line bg-paper/95"
      } ${mode === "edit" ? "sticky top-0 z-20 px-4 py-4 backdrop-blur-sm sm:px-5" : ""}`}
      role="region"
      aria-label="Deal construction budget"
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
          Construction budget
        </p>
        {mode === "summary" && onGoToCosts ? (
          <button
            type="button"
            onClick={onGoToCosts}
            className="text-xs font-semibold text-signal transition hover:text-ink"
          >
            Edit on Costs →
          </button>
        ) : null}
      </div>

      {mode === "edit" && onChange ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Field label="Deal budget" hint="Cap for the itemized sheet">
            <MoneyInput
              value={b.costBudget}
              onChange={(costBudget) =>
                onChange({ ...deal, costBudget: Math.max(0, costBudget) })
              }
            />
          </Field>
          <Field
            label="Contingency %"
            hint="Held back from working budget"
          >
            <NumberInput
              value={b.contingencyPct}
              onChange={(v) =>
                onChange({
                  ...deal,
                  contingencyPct: Math.max(0, Math.min(30, v ?? 0)),
                })
              }
              min={0}
              max={30}
              step={0.25}
            />
          </Field>
          <BudgetStat
            label="Spent"
            value={money(b.spent)}
            danger={b.status === "over"}
          />
          <BudgetStat
            label="Contingency $"
            value={b.contingencyPct > 0 ? money(b.contingencyDollars) : "—"}
          />
          <BudgetStat
            label={
              b.budgetSet
                ? b.status === "over"
                  ? "Over by"
                  : "Remaining"
                : "Working budget"
            }
            value={
              b.budgetSet && b.remaining != null
                ? money(Math.abs(b.remaining))
                : b.contingencyPct > 0 && b.budgetSet
                  ? money(b.workingBudget)
                  : "—"
            }
            danger={b.status === "over"}
            accent={b.status === "into_contingency" || b.status === "watching"}
          />
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <BudgetStat
            label="Deal budget"
            value={b.budgetSet ? money(b.costBudget) : "Not set"}
            muted={!b.budgetSet}
            compact
          />
          <BudgetStat
            label="Spent"
            value={money(b.spent)}
            danger={b.status === "over"}
            compact
          />
          <BudgetStat
            label={`Contingency${b.contingencyPct > 0 ? ` (${b.contingencyPct}%)` : ""}`}
            value={
              b.contingencyPct > 0 ? money(b.contingencyDollars) : "None"
            }
            compact
          />
          <BudgetStat
            label="Working target"
            value={b.budgetSet ? money(b.workingBudget) : "—"}
            compact
          />
          <BudgetStat
            label={b.status === "over" ? "Over by" : "Remaining"}
            value={
              b.budgetSet && b.remaining != null
                ? money(Math.abs(b.remaining))
                : "—"
            }
            danger={b.status === "over"}
            accent={b.status === "watching" || b.status === "into_contingency"}
            compact
          />
        </div>
      )}

      {b.budgetSet ? (
        <div className={mode === "summary" ? "mt-2" : "mt-4"}>
          <div className="h-1.5 overflow-hidden bg-stone">
            <div
              className={`h-full transition-[width,background-color] ${
                b.status === "over"
                  ? "bg-loss"
                  : b.status === "into_contingency"
                    ? "bg-signal"
                    : "bg-profit"
              }`}
              style={{ width: `${b.barPct}%` }}
            />
          </div>
          {b.usedPct != null ? (
            <p className="mt-1 text-xs text-muted">
              {b.usedPct}% of deal budget used
            </p>
          ) : null}
        </div>
      ) : null}

      {msg ? (
        <p
          className={`${mode === "summary" ? "mt-2" : "mt-3"} text-sm ${
            b.status === "over"
              ? "font-medium text-loss"
              : b.status === "into_contingency"
                ? "font-medium text-signal"
                : "text-muted"
          }`}
          role={b.status === "over" ? "alert" : "status"}
        >
          {msg}
        </p>
      ) : null}
    </div>
  );
}

function BudgetStat({
  label,
  value,
  danger,
  accent,
  muted,
  compact,
}: {
  label: string;
  value: string;
  danger?: boolean;
  accent?: boolean;
  muted?: boolean;
  compact?: boolean;
}) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
        {label}
      </p>
      <p
        className={`${compact ? "mt-0.5 text-lg sm:text-xl" : "mt-1.5 text-xl sm:text-2xl"} font-display tracking-tight ${
          danger
            ? "text-loss"
            : accent
              ? "text-signal"
              : muted
                ? "text-muted"
                : "text-ink"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
