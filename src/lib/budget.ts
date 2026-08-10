/**
 * Single source of truth for deal budget vs spend + go/no-go helpers.
 * Used by Costs, Final numbers, Project, and bank package (keep UI consistent).
 */

import type { Deal } from "./types";
import { sumCostItems } from "./underwriting";

export type BudgetStatus =
  | "unset"
  | "ok"
  | "watching"
  | "into_contingency"
  | "over";

export type DealBudgetSummary = {
  /** Itemized line total */
  spent: number;
  /** User target construction budget (0 = not set) */
  costBudget: number;
  budgetSet: boolean;
  /** Contingency % of cost budget (0–30) */
  contingencyPct: number;
  /** $ reserved for contingency */
  contingencyDollars: number;
  /**
   * Spend target before touching contingency.
   * When budget unset: spent (no limited working figure).
   */
  workingBudget: number;
  remaining: number | null;
  overBy: number;
  usedPct: number | null;
  barPct: number;
  status: BudgetStatus;
};

export type DecisionVerdict = {
  /** short word: Go / Caution / No-go */
  label: "Go" | "Caution" | "No-go" | "Incomplete";
  tone: "profit" | "signal" | "loss" | "muted";
  /** One sentence for the banner */
  detail: string;
};

export function clampContingencyPct(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(30, Math.round(n * 4) / 4));
}

export function summarizeBudget(deal: Deal): DealBudgetSummary {
  const spent = sumCostItems(deal.costItems ?? []);
  const costBudget = Math.max(0, Number(deal.costBudget) || 0);
  const contingencyPct = clampContingencyPct(
    Number(deal.contingencyPct) || 0,
  );
  const budgetSet = costBudget > 0;
  const contingencyDollars = budgetSet
    ? Math.round(costBudget * (contingencyPct / 100))
    : Math.round(spent * (contingencyPct / 100));
  const workingBudget = budgetSet
    ? Math.max(0, costBudget - contingencyDollars)
    : 0;

  let status: BudgetStatus = "unset";
  let remaining: number | null = null;
  let overBy = 0;
  let usedPct: number | null = null;
  let barPct = 0;

  if (budgetSet) {
    remaining = costBudget - spent;
    overBy = Math.max(0, spent - costBudget);
    usedPct = Math.min(999, Math.round((spent / costBudget) * 100));
    barPct = Math.min(100, (spent / costBudget) * 100);

    if (spent > costBudget) {
      status = "over";
    } else if (
      contingencyDollars > 0 &&
      spent > workingBudget
    ) {
      status = "into_contingency";
    } else if (spent > costBudget * 0.9) {
      status = "watching";
    } else {
      status = "ok";
    }
  }

  return {
    spent,
    costBudget,
    budgetSet,
    contingencyPct,
    contingencyDollars,
    workingBudget,
    remaining,
    overBy,
    usedPct,
    barPct,
    status,
  };
}

/** Decide using underwriting profit and budget status (call with flip or hold economics). */
export function verdictForDeal(
  deal: Deal,
  opts: {
    exitStrategy: "flip" | "hold";
    flipProfit: number;
    cashFlowMonthly: number;
    arv: number;
    totalAllIn: number;
  },
): DecisionVerdict {
  const b = summarizeBudget(deal);
  const { exitStrategy, flipProfit, cashFlowMonthly, arv, totalAllIn } = opts;

  if (!(arv > 0) && !(totalAllIn > 0) && !(b.spent > 0)) {
    return {
      label: "Incomplete",
      tone: "muted",
      detail: "Add exit value and costs so the deal can be scored.",
    };
  }

  if (b.status === "over") {
    return {
      label: "No-go",
      tone: "loss",
      detail: `Itemized spend is over the deal budget by ${formatMoneyShort(b.overBy)}. Trim scope or raise the budget before greenlighting.`,
    };
  }

  if (exitStrategy === "flip") {
    if (flipProfit < 0) {
      return {
        label: "No-go",
        tone: "loss",
        detail: "Projected profit is negative at current exit value and all-in cost.",
      };
    }
    if (b.status === "into_contingency" || flipProfit < totalAllIn * 0.05) {
      return {
        label: "Caution",
        tone: "signal",
        detail:
          b.status === "into_contingency"
            ? "Spend is into contingency. Profit is still positive — tighten costs before commit."
            : "Thin projected margin. Numbers work, but there is little room for overruns.",
      };
    }
    return {
      label: "Go",
      tone: "profit",
      detail: "Profit positive and itemized work is within budget. Ready to move this deal forward.",
    };
  }

  // hold
  if (cashFlowMonthly < 0) {
    return {
      label: "No-go",
      tone: "loss",
      detail: "Stabilized cash flow is negative at current rent and expenses.",
    };
  }
  if (b.status === "into_contingency" || cashFlowMonthly < 200) {
    return {
      label: "Caution",
      tone: "signal",
      detail:
        b.status === "into_contingency"
          ? "Spend is into contingency. Cash flow is thin — recheck hold assumptions."
          : "Cash flow is thin. Confirm rents and expenses before committing.",
    };
  }
  return {
    label: "Go",
    tone: "profit",
    detail: "Hold cash flow is positive and construction spend is within budget.",
  };
}

function formatMoneyShort(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}
