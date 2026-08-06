import type { Deal, DealAssumptions, Financing } from "./types";

export function uid(prefix = "id"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}

export function money(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(n) ? n : 0);
}

export function pct(n: number, digits = 1): string {
  if (!Number.isFinite(n)) return "—";
  return `${n.toFixed(digits)}%`;
}

export function sumCostItems(items: { amount: number }[]): number {
  return items.reduce((s, i) => s + (Number(i.amount) || 0), 0);
}

export type UnderwritingResult = {
  buildBudget: number;
  totalAllIn: number;
  loanAmount: number;
  cashRequired: number;
  financingCost: number;
  costOfSale: number;
  netSaleProceeds: number;
  flipProfit: number;
  flipRoiOnCash: number;
  flipRoiAnnualized: number;
  monthsTotal: number;
  pctOfArv: number;
  egiMonthly: number;
  noiMonthly: number;
  noiAnnual: number;
  permanentLoan: number;
  permanentPaymentMonthly: number;
  cashFlowMonthly: number;
  cashOnCashAnnual: number;
  sweatEquity: number;
  capRateOnCost: number;
  capRateOnArv: number;
};

function loanPayment(principal: number, annualRatePct: number, years: number): number {
  if (principal <= 0 || years <= 0) return 0;
  const r = annualRatePct / 100 / 12;
  const n = years * 12;
  if (r === 0) return principal / n;
  return (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

function shortTermFinancingCost(
  loan: number,
  financing: Financing,
  months: number,
): number {
  if (loan <= 0 || financing.style === "all_cash") return 0;
  const interest = loan * (financing.interestRatePct / 100) * (months / 12);
  const points = loan * (financing.pointsPct / 100);
  return interest + points;
}

export function underwrite(deal: Deal): UnderwritingResult {
  const a: DealAssumptions = deal.assumptions;
  const f: Financing = deal.financing;
  const buildBudget = sumCostItems(deal.costItems);
  const baseCapital =
    (a.purchasePrice || 0) +
    (a.closingCosts || 0) +
    buildBudget;

  const ltv = f.style === "all_cash" ? 0 : Math.min(100, Math.max(0, f.ltvPct)) / 100;
  const basisForLoan = (a.purchasePrice || 0) + buildBudget;
  const loanAmount = Math.round(basisForLoan * ltv);

  const months = Math.max(
    1,
    (a.projectMonths || 0) + (a.monthsToSaleOrRent || 0),
  );
  const projectMonths = Math.max(1, a.projectMonths || 1);
  const financingCost = shortTermFinancingCost(loanAmount, f, projectMonths);
  const totalAllIn = baseCapital + financingCost;
  const cashRequired = Math.max(0, totalAllIn - loanAmount);

  const arv = a.arv || 0;
  const costOfSale = arv * ((a.costOfSalePct || 0) / 100);
  const netSaleProceeds = arv - costOfSale;
  const flipProfit = netSaleProceeds - totalAllIn;
  const flipRoiOnCash =
    cashRequired > 0 ? (flipProfit / cashRequired) * 100 : flipProfit > 0 ? Infinity : 0;
  const flipRoiAnnualized =
    cashRequired > 0 && months > 0
      ? (flipProfit / cashRequired) * (12 / months) * 100
      : 0;

  const pctOfArv = arv > 0 ? (totalAllIn / arv) * 100 : 0;

  const gross =
    (a.grossRentMonthly || 0) + (a.otherIncomeMonthly || 0);
  const egiMonthly = gross * (1 - Math.min(100, Math.max(0, a.vacancyPct)) / 100);
  const noiMonthly = egiMonthly - (a.operatingExpensesMonthly || 0);
  const noiAnnual = noiMonthly * 12;

  const permanentLoan =
    a.refinance && arv > 0
      ? Math.round(arv * (Math.min(100, Math.max(0, a.permanentLtvPct)) / 100))
      : 0;
  const permanentPaymentMonthly = loanPayment(
    permanentLoan,
    a.permanentRatePct || 0,
    a.permanentTermYears || 30,
  );
  const cashFlowMonthly = noiMonthly - permanentPaymentMonthly;

  /** Cash still in after refi (approx): all-in cash − permanent loan proceeds + short-term payoff */
  const cashAfterRefi = a.refinance
    ? Math.max(0, totalAllIn - permanentLoan)
    : cashRequired;
  const cashOnCashAnnual =
    cashAfterRefi > 0 ? ((cashFlowMonthly * 12) / cashAfterRefi) * 100 : 0;

  const sweatEquity = arv - totalAllIn;
  const capRateOnCost = totalAllIn > 0 ? (noiAnnual / totalAllIn) * 100 : 0;
  const capRateOnArv = arv > 0 ? (noiAnnual / arv) * 100 : 0;

  return {
    buildBudget,
    totalAllIn,
    loanAmount,
    cashRequired,
    financingCost,
    costOfSale,
    netSaleProceeds,
    flipProfit,
    flipRoiOnCash: Number.isFinite(flipRoiOnCash) ? flipRoiOnCash : 0,
    flipRoiAnnualized,
    monthsTotal: months,
    pctOfArv,
    egiMonthly,
    noiMonthly,
    noiAnnual,
    permanentLoan,
    permanentPaymentMonthly,
    cashFlowMonthly,
    cashOnCashAnnual,
    sweatEquity,
    capRateOnCost,
    capRateOnArv,
  };
}
