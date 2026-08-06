import { sanitizeCostItems, sumCostItems } from "@/lib/cost-items";
import type { PropertyInfo, UnderwritingAssumptions } from "@/lib/types";

export type FlipResult = {
  totalCapitalNeeded: number;
  cashRequired: number;
  allInAtRehab: number;
  costOfSale: number;
  pctOfArv: number;
  projectedProfit: number;
  roiOnCash: number;
  annualizedRoi: number;
  loanAmount: number;
  monthsHeld: number;
  mathOk: boolean;
  /** True when ARV looks like a seed bug relative to into-money */
  arvSuspect: boolean;
  suggestedArv: number | null;
  breakdown: {
    purchase: number;
    rehab: number;
    closing: number;
    holding: number;
    costOfSale: number;
    profit: number;
  };
};

export type RentResult = {
  totalCapitalNeeded: number;
  cashRequired: number;
  allInAtRehab: number;
  pctOfArv: number;
  monthlyNoi: number;
  annualNoi: number;
  sweatEquity: number;
  cashOnCash: number;
  capRateOnCost: number;
  capRateOnArv: number;
  paybackYears: number | null;
  mathOk: boolean;
  arvSuspect: boolean;
};

export function defaultPropertyInfo(
  address = "",
  name = "",
): PropertyInfo {
  return {
    propertyName: name,
    description: "",
    address,
    city: "",
    state: "",
    zip: "",
    apn: "",
    ownerName: "",
    ownerMailing: "",
    beds: null,
    baths: null,
    sqft: null,
    yearBuilt: null,
    units: 1,
    propertyType: "Single Family",
    lotAcres: null,
    lotSf: null,
    zoning: "",
    ownerOccupied: null,
    estValue: null,
    lastSaleAmount: null,
    lastSaleDate: "",
    taxAssessment: null,
    landValue: null,
    improvementValue: null,
    taxYear: "",
  };
}

export function defaultUnderwriting(
  seed?: Partial<UnderwritingAssumptions>,
): UnderwritingAssumptions {
  return sanitizeUnderwriting({
    purchasePrice: 50000,
    closingCosts: 1500,
    holdingCosts: 1500,
    rehabBudget: 20000,
    rehabMonths: 2,
    financing: "all-cash",
    downPaymentPct: 100,
    arv: 100000,
    monthsToSale: 2,
    costOfSalePct: 6,
    resalePrice: 100000,
    monthlyRent: 1800,
    monthlyExpenses: 500,
    monthsToRent: 2,
    refinance: false,
    ...seed,
  });
}

/** Into-money basis used for ceilings and ratios */
function intoMoney(a: UnderwritingAssumptions) {
  return (
    Math.max(0, Number(a.purchasePrice) || 0) +
    Math.max(0, Number(a.rehabBudget) || 0)
  );
}

/** Suggested realistic exit when ARV is absurd relative to costs */
export function suggestedArvCap(a: UnderwritingAssumptions): number {
  const purchase = Math.max(0, Number(a.purchasePrice) || 0);
  const basis = intoMoney(a);
  const ceiling = Math.max(basis * 1.85, purchase * 2.25, 150_000);
  return Math.round(ceiling);
}

/**
 * Clamp / normalize underwriting so bad seeds (lot×$/sf fantasies) cannot
 * persist into projects. Prefer calling on load / deal seed — not on every keystroke.
 */
export function sanitizeUnderwriting(
  a: UnderwritingAssumptions,
): UnderwritingAssumptions {
  const purchase = Math.max(0, Number(a.purchasePrice) || 0);
  const rehab = Math.max(0, Number(a.rehabBudget) || 0);
  const closing = Math.max(0, Number(a.closingCosts) || 0);
  const holding = Math.max(0, Number(a.holdingCosts) || 0);
  const costOfSalePct = Math.min(Math.max(Number(a.costOfSalePct) || 0, 0), 25);
  let down =
    a.financing === "all-cash"
      ? 100
      : Math.min(Math.max(Number(a.downPaymentPct) || 20, 0), 100);
  if (a.financing === "hard-money" && down === 100) down = 20;

  let arv = Math.max(0, Number(a.arv) || 0);
  let resale = Math.max(0, Number(a.resalePrice) || arv);
  if (resale <= 0) resale = arv;
  if (arv <= 0) arv = resale;

  const costItems = sanitizeCostItems(a.costItems);
  const rehabFinal =
    costItems && costItems.length > 0 ? sumCostItems(costItems) : rehab;

  const basis = purchase + rehabFinal;
  const ceiling = Math.max(basis * 2.25, purchase * 2.5, 150_000);
  if (basis > 0 && arv > ceiling) {
    arv = Math.round(Math.min(ceiling, basis * 1.85));
    resale = arv;
  }

  let rent = Math.max(0, Number(a.monthlyRent) || 0);
  if (arv > 0 && rent > arv * 0.02) {
    rent = Math.round(arv * 0.0055);
  }

  return {
    purchasePrice: Math.round(purchase),
    closingCosts: Math.round(closing),
    holdingCosts: Math.round(holding),
    rehabBudget: Math.round(rehabFinal),
    rehabMonths: Math.max(1, Math.round(Number(a.rehabMonths) || 2)),
    financing: a.financing === "hard-money" ? "hard-money" : "all-cash",
    downPaymentPct: down,
    arv: Math.round(arv),
    monthsToSale: Math.max(1, Math.round(Number(a.monthsToSale) || 2)),
    costOfSalePct,
    resalePrice: Math.round(resale),
    monthlyRent: Math.round(rent),
    monthlyExpenses: Math.max(0, Math.round(Number(a.monthlyExpenses) || 0)),
    monthsToRent: Math.max(1, Math.round(Number(a.monthsToRent) || 2)),
    refinance: Boolean(a.refinance),
    ...(costItems ? { costItems } : {}),
  };
}

/** Coerce number fields only — preserve user ARV for live calculator identity. */
function normalizeInputs(a: UnderwritingAssumptions): UnderwritingAssumptions {
  const financing = a.financing === "hard-money" ? "hard-money" : "all-cash";
  let down =
    financing === "all-cash"
      ? 100
      : Math.min(Math.max(Number(a.downPaymentPct) || 20, 0), 100);
  if (financing === "hard-money" && down === 100) down = 20;

  const arv = Math.max(0, Number(a.arv) || 0);
  let resale = Math.max(0, Number(a.resalePrice) || 0);
  if (resale <= 0) resale = arv;

  const costItems = sanitizeCostItems(a.costItems);
  let rehabBudget = Math.max(0, Number(a.rehabBudget) || 0);
  // Keep underwriting total in lockstep when a schedule exists
  if (costItems && costItems.length > 0) {
    rehabBudget = sumCostItems(costItems);
  }

  return {
    purchasePrice: Math.max(0, Number(a.purchasePrice) || 0),
    closingCosts: Math.max(0, Number(a.closingCosts) || 0),
    holdingCosts: Math.max(0, Number(a.holdingCosts) || 0),
    rehabBudget,
    rehabMonths: Math.max(1, Number(a.rehabMonths) || 1),
    financing,
    downPaymentPct: down,
    arv,
    monthsToSale: Math.max(1, Number(a.monthsToSale) || 1),
    costOfSalePct: Math.min(Math.max(Number(a.costOfSalePct) || 0, 0), 100),
    resalePrice: resale,
    monthlyRent: Math.max(0, Number(a.monthlyRent) || 0),
    monthlyExpenses: Math.max(0, Number(a.monthlyExpenses) || 0),
    monthsToRent: Math.max(1, Number(a.monthsToRent) || 1),
    refinance: Boolean(a.refinance),
    ...(costItems ? { costItems } : {}),
  };
}

/** Regional cost breakdown — shared by Cost Modeling UI and deal seeds. */
export function regionalBuildCosts(
  gsf: number,
  hardCostPsf: number,
  softPct: number,
  contingencyPct: number,
) {
  const hard = gsf * hardCostPsf;
  const soft = hard * softPct;
  const contingency = (hard + soft) * contingencyPct;
  const total = hard + soft + contingency;
  /** Light rehab proxy: 35% hard + 50% soft (no contingency on proxy). */
  const rehabProxy = Math.round(hard * 0.35 + soft * 0.5);
  return {
    hard: Math.round(hard),
    soft: Math.round(soft),
    contingency: Math.round(contingency),
    total: Math.round(total),
    rehabProxy,
    perSf: gsf > 0 ? total / gsf : 0,
  };
}

/**
 * Flip math (identity — results must reconcile to the fields shown):
 *   allIn   = purchase + closing + holding + rehab
 *   loan    = purchase × (1 − down%)   [hard money funds purchase only]
 *   cash    = purchase×down% + closing + holding + rehab
 *   saleCost= exit × costOfSale%
 *   profit  = exit − allIn − saleCost
 *   ROI%    = profit / cash × 100
 *   ann%    = ROI% × 12 / monthsHeld
 */
export function calcFlip(a: UnderwritingAssumptions): FlipResult {
  const u = normalizeInputs(a);
  const downPct = u.downPaymentPct;
  const purchaseCash = u.purchasePrice * (downPct / 100);
  const loanAmount = u.purchasePrice - purchaseCash;
  const allInAtRehab =
    u.purchasePrice + u.closingCosts + u.holdingCosts + u.rehabBudget;
  const cashRequired =
    purchaseCash + u.closingCosts + u.holdingCosts + u.rehabBudget;
  const resale = u.resalePrice > 0 ? u.resalePrice : u.arv;
  const costOfSale = resale * (u.costOfSalePct / 100);
  const projectedProfit = resale - allInAtRehab - costOfSale;
  const roiOnCash =
    cashRequired > 0 ? (projectedProfit / cashRequired) * 100 : 0;
  const monthsHeld = Math.max(u.rehabMonths + u.monthsToSale, 1);
  const annualizedRoi = roiOnCash * (12 / monthsHeld);
  const pctOfArv = resale > 0 ? (allInAtRehab / resale) * 100 : 0;

  const profitCheck =
    resale -
    (u.purchasePrice + u.closingCosts + u.holdingCosts + u.rehabBudget) -
    costOfSale;
  const mathOk = Math.abs(projectedProfit - profitCheck) < 0.5;

  const basis = u.purchasePrice + u.rehabBudget;
  const ceiling = Math.max(basis * 2.25, u.purchasePrice * 2.5, 150_000);
  const arvSuspect = basis > 0 && resale > ceiling;

  return {
    totalCapitalNeeded: cashRequired,
    cashRequired,
    allInAtRehab,
    costOfSale,
    pctOfArv,
    projectedProfit,
    roiOnCash,
    annualizedRoi,
    loanAmount,
    monthsHeld,
    mathOk,
    arvSuspect,
    suggestedArv: arvSuspect ? suggestedArvCap(u) : null,
    breakdown: {
      purchase: u.purchasePrice,
      rehab: u.rehabBudget,
      closing: u.closingCosts,
      holding: u.holdingCosts,
      costOfSale,
      profit: projectedProfit,
    },
  };
}

export function calcRent(a: UnderwritingAssumptions): RentResult {
  const u = normalizeInputs(a);
  const downPct = u.downPaymentPct;
  const purchaseCash = u.purchasePrice * (downPct / 100);
  const allInAtRehab =
    u.purchasePrice + u.closingCosts + u.holdingCosts + u.rehabBudget;
  const cashRequired =
    purchaseCash + u.closingCosts + u.holdingCosts + u.rehabBudget;
  const monthlyNoi = u.monthlyRent - u.monthlyExpenses;
  const annualNoi = monthlyNoi * 12;
  const exit = u.arv > 0 ? u.arv : u.resalePrice;
  const sweatEquity = exit - allInAtRehab;
  const cashOnCash =
    cashRequired > 0 ? (annualNoi / cashRequired) * 100 : 0;
  const capRateOnCost =
    allInAtRehab > 0 ? (annualNoi / allInAtRehab) * 100 : 0;
  const capRateOnArv = exit > 0 ? (annualNoi / exit) * 100 : 0;
  const paybackYears =
    monthlyNoi > 0 ? cashRequired / (monthlyNoi * 12) : null;
  const pctOfArv = exit > 0 ? (allInAtRehab / exit) * 100 : 0;

  const mathOk =
    Math.abs(monthlyNoi - (u.monthlyRent - u.monthlyExpenses)) < 0.5 &&
    Math.abs(annualNoi - monthlyNoi * 12) < 0.5;

  const basis = u.purchasePrice + u.rehabBudget;
  const ceiling = Math.max(basis * 2.25, u.purchasePrice * 2.5, 150_000);
  const arvSuspect = basis > 0 && exit > ceiling;

  return {
    totalCapitalNeeded: cashRequired,
    cashRequired,
    allInAtRehab,
    pctOfArv,
    monthlyNoi,
    annualNoi,
    sweatEquity,
    cashOnCash,
    capRateOnCost,
    capRateOnArv,
    paybackYears,
    mathOk,
    arvSuspect,
  };
}

/** Pure math checksum for UI verification */
export function flipMathLines(a: UnderwritingAssumptions) {
  const f = calcFlip(a);
  const u = normalizeInputs(a);
  const allIn =
    u.purchasePrice + u.closingCosts + u.holdingCosts + u.rehabBudget;
  return {
    allIn,
    costOfSale: f.costOfSale,
    profit: f.projectedProfit,
    cashRequired: f.cashRequired,
    roiOnCash: f.roiOnCash,
    annualizedRoi: f.annualizedRoi,
    check: f.mathOk && Math.abs(f.allInAtRehab - allIn) < 0.5,
  };
}

/** Demo property pull — replaces real assessor API until wired */
export function sampleGetData(query: string): Partial<PropertyInfo> {
  const q = query.trim() || "Sample Street";
  const hash = Array.from(q).reduce((a, c) => a + c.charCodeAt(0), 0);
  const lotSf = 6000 + (hash % 8000);
  const land = 80000 + (hash % 200) * 1000;
  const improv = 15000 + (hash % 80) * 500;
  const lastSale = 45000 + (hash % 100) * 500;
  const sqft = 900 + (hash % 1200);
  const estValue = Math.round(sqft * 180 + land * 0.15);

  return {
    address: q.includes(",") ? q.split(",")[0].trim() : q,
    city: q.toLowerCase().includes("richmond")
      ? "Richmond"
      : q.toLowerCase().includes("katy")
        ? "Katy"
        : "Houston",
    state:
      q.toLowerCase().includes("va") || q.toLowerCase().includes("richmond")
        ? "VA"
        : "TX",
    zip: String(77000 + (hash % 99)),
    apn: `DEMO-${100000 + (hash % 900000)}`,
    ownerName: "Record Owner (demo)",
    ownerMailing: "Mailing on file — demo pull",
    beds: 2 + (hash % 3),
    baths: 1 + (hash % 2),
    sqft,
    yearBuilt: 1940 + (hash % 50),
    units: 1,
    propertyType: "Single Family",
    lotAcres: Number((lotSf / 43560).toFixed(3)),
    lotSf,
    zoning: hash % 2 === 0 ? "R-2" : "SF-1",
    ownerOccupied: hash % 3 !== 0,
    estValue,
    lastSaleAmount: lastSale,
    lastSaleDate: `${2010 + (hash % 14)}-06-15`,
    taxAssessment: land + improv,
    landValue: land,
    improvementValue: improv,
    taxYear: "2025",
    description:
      "Demo property pull. Connect HCAD / VA assessor for live records.",
  };
}
