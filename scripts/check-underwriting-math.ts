/**
 * Underwriting identity tests — run: npx tsx scripts/check-underwriting-math.ts
 */
import {
  calcFlip,
  calcRent,
  regionalBuildCosts,
  sanitizeUnderwriting,
  flipMathLines,
} from "../src/lib/underwriting";
import {
  buildTemplateItems,
  scaleCostItems,
  sumCostItems,
} from "../src/lib/cost-items";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

function nearly(a: number, b: number, eps = 0.6) {
  return Math.abs(a - b) < eps;
}

// Regional rehab proxy matches Cost Modeling labels
const costs = regionalBuildCosts(1300, 140, 0.12, 0.06);
assert(costs.hard === 182000, `hard expected 182000 got ${costs.hard}`);
assert(
  costs.rehabProxy === Math.round(182000 * 0.35 + 182000 * 0.12 * 0.5),
  `rehabProxy mismatch ${costs.rehabProxy}`,
);
assert(costs.hard !== costs.rehabProxy, "hard should differ from rehab proxy");
assert(costs.rehabProxy === 74620, `screenshot rehab proxy got ${costs.rehabProxy}`);

// Itemized schedule sums and syncs into rehabBudget
{
  const items = buildTemplateItems("rehab", 74620);
  assert(items.length >= 8, "template lines");
  assert(nearly(sumCostItems(items), 74620), "template sum");
  const scaled = scaleCostItems(items, 100000);
  assert(nearly(sumCostItems(scaled), 100000), "scale sum");
  const uw = sanitizeUnderwriting({
    purchasePrice: 80000,
    closingCosts: 1600,
    holdingCosts: 1200,
    rehabBudget: 1, // should be overwritten by lines
    rehabMonths: 4,
    financing: "all-cash",
    downPaymentPct: 100,
    arv: 220000,
    monthsToSale: 2,
    costOfSalePct: 6,
    resalePrice: 220000,
    monthlyRent: 1600,
    monthlyExpenses: 500,
    monthsToRent: 2,
    refinance: false,
    costItems: items,
  });
  assert(nearly(uw.rehabBudget, 74620), `items own budget: ${uw.rehabBudget}`);
  assert(uw.costItems?.length === items.length, "items persist");
  const f = calcFlip(uw);
  assert(nearly(f.breakdown.rehab, 74620), "flip uses item total");
}

// Flip all cash
{
  const uw = {
    purchasePrice: 86772,
    closingCosts: 1735,
    holdingCosts: 1302,
    rehabBudget: 74620,
    rehabMonths: 6,
    financing: "all-cash" as const,
    downPaymentPct: 100,
    arv: 295000,
    monthsToSale: 3,
    costOfSalePct: 6,
    resalePrice: 295000,
    monthlyRent: 1600,
    monthlyExpenses: 500,
    monthsToRent: 2,
    refinance: false,
  };
  const f = calcFlip(uw);
  const expectedAllIn = 86772 + 1735 + 1302 + 74620;
  assert(nearly(f.allInAtRehab, expectedAllIn), "all-in");
  assert(nearly(f.cashRequired, expectedAllIn), "all-cash cash");
  const expectedCos = 295000 * 0.06;
  assert(nearly(f.costOfSale, expectedCos), "cost of sale");
  const expectedProfit = 295000 - expectedAllIn - expectedCos;
  assert(nearly(f.projectedProfit, expectedProfit), "profit");
  const expectedRoi = (expectedProfit / expectedAllIn) * 100;
  assert(nearly(f.roiOnCash, expectedRoi, 0.05), "roi");
  assert(f.mathOk, "mathOk flip");
  assert(!f.arvSuspect, "sane ARV not suspect");
  assert(flipMathLines(uw).check, "flipMathLines");
}

// Fantasy ARV still identity
{
  const f = calcFlip({
    purchasePrice: 86772,
    closingCosts: 1735,
    holdingCosts: 1302,
    rehabBudget: 74620,
    rehabMonths: 6,
    financing: "hard-money",
    downPaymentPct: 20,
    arv: 3441820,
    monthsToSale: 7,
    costOfSalePct: 6,
    resalePrice: 3441820,
    monthlyRent: 18900,
    monthlyExpenses: 5000,
    monthsToRent: 2,
    refinance: false,
  });
  const allIn = 86772 + 1735 + 1302 + 74620;
  assert(nearly(f.allInAtRehab, allIn), "fantasy all-in");
  assert(f.arvSuspect, "mega ARV should be flagged");
  assert(f.mathOk, "identity still holds on fantasy inputs");
}

// Sanitize crushing mega ARV
{
  const s = sanitizeUnderwriting({
    purchasePrice: 86772,
    closingCosts: 1735,
    holdingCosts: 1302,
    rehabBudget: 74620,
    rehabMonths: 6,
    financing: "hard-money",
    downPaymentPct: 20,
    arv: 3441820,
    monthsToSale: 7,
    costOfSalePct: 6,
    resalePrice: 3441820,
    monthlyRent: 18900,
    monthlyExpenses: 5000,
    monthsToRent: 2,
    refinance: false,
  });
  assert(s.arv < 500000, `sanitized ARV too high: ${s.arv}`);
  const f = calcFlip(s);
  assert(f.roiOnCash < 400, `ROI still inflated: ${f.roiOnCash}`);
  assert(f.mathOk, "sanitize flip ok");
}

// Hard money 20% down
{
  const f = calcFlip({
    purchasePrice: 100000,
    closingCosts: 2000,
    holdingCosts: 1000,
    rehabBudget: 40000,
    rehabMonths: 3,
    financing: "hard-money",
    downPaymentPct: 20,
    arv: 200000,
    monthsToSale: 2,
    costOfSalePct: 6,
    resalePrice: 200000,
    monthlyRent: 0,
    monthlyExpenses: 0,
    monthsToRent: 1,
    refinance: false,
  });
  assert(nearly(f.loanAmount, 80000), `loan ${f.loanAmount}`);
  assert(nearly(f.cashRequired, 20000 + 2000 + 1000 + 40000), "hm cash");
  assert(f.mathOk, "hm mathOk");
}

// Rent identity
{
  const r = calcRent({
    purchasePrice: 200000,
    closingCosts: 3000,
    holdingCosts: 2000,
    rehabBudget: 30000,
    rehabMonths: 2,
    financing: "all-cash",
    downPaymentPct: 100,
    arv: 280000,
    monthsToSale: 1,
    costOfSalePct: 6,
    resalePrice: 280000,
    monthlyRent: 2200,
    monthlyExpenses: 700,
    monthsToRent: 1,
    refinance: true,
  });
  assert(nearly(r.monthlyNoi, 1500), "noi");
  assert(nearly(r.annualNoi, 18000), "annual noi");
  assert(r.mathOk, "rent mathOk");
}

console.log("All underwriting math checks passed.");
