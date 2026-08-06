"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  BUILD_COSTS,
  PRODUCT_META,
  productsByCategory,
  type MarketId,
  type ProductType,
} from "@/data/markets";
import type { CostLineItem, UnderwritingAssumptions } from "@/lib/types";
import {
  calcFlip,
  calcRent,
  defaultUnderwriting,
  regionalBuildCosts,
  sanitizeUnderwriting,
} from "@/lib/underwriting";
import { sumCostItems, buildTemplateItems, scaleCostItems } from "@/lib/cost-items";
import { CostItemizer } from "@/components/CostItemizer";

const FALLBACK_REGIONS: Record<
  string,
  { label: string; hardCostPsf: number; softPct: number; contingency: number }
> = {
  austin: {
    label: "Austin MSA (reference)",
    hardCostPsf: 245,
    softPct: 0.18,
    contingency: 0.08,
  },
  denver: {
    label: "Denver MSA (reference)",
    hardCostPsf: 268,
    softPct: 0.17,
    contingency: 0.09,
  },
};

type Strategy = "flip" | "rent";
type Scope = "rehab" | "new_build";

function money(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function pct(n: number) {
  return `${n.toFixed(1)}%`;
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-sage">
        {label}
      </span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

const inputClass =
  "w-full border border-line bg-paper px-3 py-2 text-sm outline-none ring-copper focus:ring-1";

type CostModelingProps = {
  projectHref?: string;
  initialUw?: Partial<UnderwritingAssumptions>;
  /** Seed finished/GSF slider from property living or deal capacity */
  initialGsf?: number | null;
  initialUnits?: number | null;
  initialProductType?: ProductType;
  initialRegion?: string;
  onUwChange?: (uw: UnderwritingAssumptions) => void;
};

export function CostModeling({
  projectHref,
  initialUw,
  initialGsf,
  initialUnits,
  initialProductType = "for_sale_sf",
  initialRegion = "houston",
  onUwChange,
}: CostModelingProps) {
  const [region, setRegion] = useState(initialRegion);
  const [productType, setProductType] =
    useState<ProductType>(initialProductType);
  const [scope, setScope] = useState<Scope>("rehab");
  const [strategy, setStrategy] = useState<Strategy>("flip");
  const [gsf, setGsf] = useState(() => {
    if (initialGsf && initialGsf >= 400) return Math.round(initialGsf);
    return 1800;
  });
  const [units, setUnits] = useState(() =>
    initialUnits && initialUnits >= 1 ? initialUnits : 1,
  );
  const [uw, setUw] = useState<UnderwritingAssumptions>(() =>
    sanitizeUnderwriting(defaultUnderwriting(initialUw)),
  );

  const marketId: MarketId | null =
    region === "houston" || region === "virginia" ? region : null;
  const grouped = marketId ? productsByCategory(marketId) : null;
  const productMeta = PRODUCT_META[productType];

  const band = useMemo(() => {
    if (marketId) {
      const match = BUILD_COSTS.find(
        (b) => b.marketId === marketId && b.productType === productType,
      );
      if (match) {
        return {
          label: match.label,
          hardCostPsf: match.hardCostPsf,
          softPct: match.softPct,
          contingency: match.contingencyPct,
        };
      }
    }
    const fb = FALLBACK_REGIONS[region];
    return fb
      ? {
          label: fb.label,
          hardCostPsf: fb.hardCostPsf,
          softPct: fb.softPct,
          contingency: fb.contingency,
        }
      : {
          label: "Custom",
          hardCostPsf: 160,
          softPct: 0.15,
          contingency: 0.07,
        };
  }, [marketId, productType, region]);

  useEffect(() => {
    if (productMeta.category === "multifamily") {
      setScope("new_build");
      setGsf((g) => (g < 10000 ? 92000 : g));
      setUnits((u) => (u < 8 ? Math.max(initialUnits ?? 48, 48) : u));
    } else if (productType === "duplex_quad") {
      setGsf((g) => (g > 8000 ? 3200 : g));
      setUnits((u) => (u > 4 ? Math.min(initialUnits ?? 2, 4) : u));
    } else {
      // Keep deal/property sf; only clamp if user picks product after huge MF GSF
      setGsf((g) => (g > 8000 ? Math.min(initialGsf ?? 1800, 6000) : g));
      setUnits(1);
    }
    // Only react to product switches — not initialGsf changes mid-session
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productType, productMeta.category]);

  const residentialScale =
    scope === "rehab" || productMeta.category === "residential";

  const build = useMemo(() => {
    const base = regionalBuildCosts(
      gsf,
      band.hardCostPsf,
      band.softPct,
      band.contingency,
    );
    return {
      ...base,
      perUnit: base.total / Math.max(units, 1),
    };
  }, [band, gsf, units]);

  const constructionFromModel =
    scope === "new_build" ? Math.round(build.total) : build.rehabProxy;

  const flip = useMemo(() => calcFlip(uw), [uw]);
  const rent = useMemo(() => calcRent(uw), [uw]);

  function patchUw(patch: Partial<UnderwritingAssumptions>) {
    setUw((prev) => {
      // Live edits stay exact so on-screen totals match the inputs
      const next = { ...prev, ...patch };
      onUwChange?.(next);
      return next;
    });
  }

  function applyBuildToDeal() {
    setUw((prev) => {
      const nextItems =
        prev.costItems && prev.costItems.length > 0
          ? scaleCostItems(prev.costItems, constructionFromModel)
          : buildTemplateItems(scope, constructionFromModel);
      const next = {
        ...prev,
        rehabBudget: constructionFromModel,
        costItems: nextItems,
      };
      onUwChange?.(next);
      return next;
    });
  }

  function applyCostItems(items: CostLineItem[]) {
    const total = sumCostItems(items);
    setUw((prev) => {
      const next: UnderwritingAssumptions = {
        ...prev,
        costItems: items.length ? items : undefined,
        rehabBudget: items.length ? total : prev.rehabBudget,
      };
      onUwChange?.(next);
      return next;
    });
  }

  function setRehabBudget(value: number) {
    const amount = Math.max(0, value);
    setUw((prev) => {
      let next: UnderwritingAssumptions;
      if (prev.costItems && prev.costItems.length > 0) {
        next = {
          ...prev,
          rehabBudget: amount,
          costItems: scaleCostItems(prev.costItems, amount),
        };
      } else {
        next = { ...prev, rehabBudget: amount };
      }
      onUwChange?.(next);
      return next;
    });
  }

  function applyRealisticArv() {
    if (flip.suggestedArv == null) return;
    const arv = flip.suggestedArv;
    patchUw({
      arv,
      resalePrice: arv,
      monthlyRent: Math.max(1200, Math.round(arv * 0.0055)),
      monthlyExpenses: Math.max(400, Math.round(arv * 0.0015)),
    });
  }

  return (
    <div className="space-y-10">
      <p className="text-sm text-steel">
        Underwrite{" "}
        <span className="font-medium text-ink">residential</span> (SF flip /
        BTR, duplex–fourplex, townhomes) and{" "}
        <span className="font-medium text-ink">multifamily</span> (garden +
        mid-rise) with the same cost → return model.
      </p>

      {grouped && (
        <label className="block max-w-xl">
          <span className="text-xs font-medium uppercase tracking-[0.16em] text-sage">
            Product type
          </span>
          <select
            className={`${inputClass} mt-2`}
            value={productType}
            onChange={(e) => setProductType(e.target.value as ProductType)}
          >
            <optgroup label="Residential">
              {grouped.residential.map((p) => (
                <option key={p.productType} value={p.productType}>
                  {p.label}
                </option>
              ))}
            </optgroup>
            <optgroup label="Multifamily">
              {grouped.multifamily.map((p) => (
                <option key={p.productType} value={p.productType}>
                  {p.label}
                </option>
              ))}
            </optgroup>
          </select>
          <p className="mt-2 text-xs text-steel">{productMeta.blurb}</p>
        </label>
      )}

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["rehab", "Rehab / rebuild cost"],
            ["new_build", "New construction"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setScope(id)}
            className={`px-4 py-2 text-sm transition ${
              scope === id
                ? "bg-ink text-paper"
                : "border border-line text-steel hover:border-ink"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <div className="border border-line bg-limestone p-5 sm:p-6">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-sage">
            01 · Regional build cost
          </p>
          <h2 className="mt-2 font-display text-2xl text-ink">
            {scope === "rehab" ? "Rehab budget from region" : "Full build budget"}
          </h2>
          <p className="mt-2 text-sm text-steel">
            {band.label} · {money(band.hardCostPsf)}/sf hard
          </p>

          <div className="mt-6 space-y-5">
            <Field label="Region">
              <select
                className={inputClass}
                value={region}
                onChange={(e) => {
                  setRegion(e.target.value);
                  if (
                    e.target.value === "houston" ||
                    e.target.value === "virginia"
                  ) {
                    setProductType("for_sale_sf");
                  }
                }}
              >
                <option value="houston">Houston + 100 mi</option>
                <option value="virginia">Northern VA → Richmond</option>
                <option value="austin">Austin MSA (reference)</option>
                <option value="denver">Denver MSA (reference)</option>
              </select>
            </Field>

            <label className="block">
              <div className="flex justify-between text-sm">
                <span className="font-medium text-ink">
                  {residentialScale
                    ? "Finished / subject sf"
                    : "Gross square feet"}
                </span>
                <span className="font-mono text-sage">
                  {gsf.toLocaleString()}
                </span>
              </div>
              <input
                type="range"
                min={residentialScale ? 600 : 10000}
                max={residentialScale ? 6000 : 180000}
                step={residentialScale ? 50 : 1000}
                value={gsf}
                onChange={(e) => setGsf(Number(e.target.value))}
                className="mt-3 w-full accent-copper"
              />
            </label>

            {(scope === "new_build" ||
              productMeta.category === "multifamily" ||
              productType === "duplex_quad") && (
              <label className="block">
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-ink">Units / doors</span>
                  <span className="font-mono text-sage">{units}</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={productMeta.category === "multifamily" ? 200 : 4}
                  value={units}
                  onChange={(e) => setUnits(Number(e.target.value))}
                  className="mt-3 w-full accent-copper"
                />
              </label>
            )}

            <div className="border border-line bg-paper p-4">
              <p className="text-[10px] uppercase tracking-wider text-sage">
                {scope === "rehab"
                  ? "Suggested rehab budget"
                  : "Total development cost"}
              </p>
              <p className="mt-2 font-display text-3xl text-ink">
                {money(constructionFromModel)}
              </p>
              {scope === "rehab" ? (
                <p className="mt-2 text-xs leading-relaxed text-steel">
                  Light-rehab proxy (not full rebuild): 35% hard + 50% soft ={" "}
                  {money(constructionFromModel)}.
                  <br />
                  Full new-build hard = {gsf.toLocaleString()} ×{" "}
                  {money(band.hardCostPsf)}/sf = {money(build.hard)}; soft{" "}
                  {money(build.soft)}. Those are different numbers by design.
                </p>
              ) : (
                <p className="mt-1 text-sm text-steel">
                  Hard {money(build.hard)} · Soft {money(build.soft)} ·
                  Contingency {money(build.contingency)}
                </p>
              )}
              {Math.abs(uw.rehabBudget - constructionFromModel) > 1 && (
                <p className="mt-2 text-xs text-copper">
                  Deal uses {money(uw.rehabBudget)} — click below to replace with
                  this model.
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={applyBuildToDeal}
              className="w-full bg-ink px-4 py-3 text-sm font-medium text-paper transition hover:bg-forest"
            >
              Use as deal construction cost
            </button>
          </div>
        </div>

        <div className="border border-line bg-paper p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-sage">
                02 · Deal underwriting
              </p>
              <h2 className="mt-2 font-display text-2xl text-ink">
                Purchase + cost → return
              </h2>
            </div>
            <div className="flex gap-2">
              {(
                [
                  ["flip", "Flip / resale"],
                  ["rent", "Rent / BRRRR"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setStrategy(id)}
                  className={`px-3 py-1.5 text-sm ${
                    strategy === id
                      ? "bg-forest text-paper"
                      : "border border-line text-steel"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <Field label="Purchase price">
              <input
                type="number"
                className={inputClass}
                value={uw.purchasePrice}
                onChange={(e) =>
                  patchUw({ purchasePrice: Number(e.target.value) || 0 })
                }
              />
            </Field>
            <Field label="Construction / rehab">
              <input
                type="number"
                className={inputClass}
                value={uw.rehabBudget}
                onChange={(e) =>
                  setRehabBudget(Number(e.target.value) || 0)
                }
              />
              {uw.costItems && uw.costItems.length > 0 && (
                <p className="mt-1 text-[10px] text-sage">
                  From itemized lines — changing amount scales all lines
                </p>
              )}
            </Field>
            <Field label="Closing costs">
              <input
                type="number"
                className={inputClass}
                value={uw.closingCosts}
                onChange={(e) =>
                  patchUw({ closingCosts: Number(e.target.value) || 0 })
                }
              />
            </Field>
            <Field label="Holding costs">
              <input
                type="number"
                className={inputClass}
                value={uw.holdingCosts}
                onChange={(e) =>
                  patchUw({ holdingCosts: Number(e.target.value) || 0 })
                }
              />
            </Field>
            <Field label="Financing">
              <select
                className={inputClass}
                value={uw.financing}
                onChange={(e) =>
                  patchUw({
                    financing: e.target.value as "all-cash" | "hard-money",
                    downPaymentPct: e.target.value === "all-cash" ? 100 : 20,
                  })
                }
              >
                <option value="all-cash">All cash</option>
                <option value="hard-money">Hard money / loan (20% down)</option>
              </select>
            </Field>
            {uw.financing === "hard-money" && (
              <Field label="Down payment %">
                <input
                  type="number"
                  min={0}
                  max={100}
                  className={inputClass}
                  value={uw.downPaymentPct}
                  onChange={(e) =>
                    patchUw({ downPaymentPct: Number(e.target.value) || 0 })
                  }
                />
              </Field>
            )}
            <Field label="ARV / exit value">
              <input
                type="number"
                className={inputClass}
                value={uw.arv}
                onChange={(e) => {
                  const arv = Number(e.target.value) || 0;
                  patchUw({ arv, resalePrice: arv });
                }}
              />
            </Field>
          </div>

          {strategy === "flip" && flip.arvSuspect && flip.suggestedArv != null && (
            <div className="mt-4 border border-copper/40 bg-limestone px-3 py-3 text-sm text-ink">
              <p className="font-medium text-copper">
                Exit looks inflated vs into-money
              </p>
              <p className="mt-1 text-xs leading-relaxed text-steel">
                ARV {money(uw.arv)} is far above purchase + rehab (
                {money(uw.purchasePrice + uw.rehabBudget)}). Math below is
                still correct for the numbers entered — ROI will look extreme
                until exit is realistic.
              </p>
              <button
                type="button"
                onClick={applyRealisticArv}
                className="mt-2 text-xs font-medium text-forest underline-offset-2 hover:underline"
              >
                Reset ARV to {money(flip.suggestedArv)} (~1.85× into-money)
              </button>
            </div>
          )}

          {strategy === "flip" ? (
            <>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Field label="Cost of sale %">
                  <input
                    type="number"
                    className={inputClass}
                    value={uw.costOfSalePct}
                    onChange={(e) =>
                      patchUw({ costOfSalePct: Number(e.target.value) || 0 })
                    }
                  />
                </Field>
                <Field label="Months (rehab + sell)">
                  <input
                    type="number"
                    className={inputClass}
                    value={uw.rehabMonths + uw.monthsToSale}
                    onChange={(e) => {
                      const total = Number(e.target.value) || 4;
                      patchUw({
                        rehabMonths: Math.max(1, Math.floor(total / 2)),
                        monthsToSale: Math.max(1, Math.ceil(total / 2)),
                      });
                    }}
                  />
                </Field>
              </div>
              <dl className="mt-6 space-y-2 border-t border-line pt-5 text-sm">
                {[
                  [
                    "All-in cost",
                    money(flip.allInAtRehab),
                    `${money(uw.purchasePrice)} + ${money(uw.closingCosts)} + ${money(uw.holdingCosts)} + ${money(uw.rehabBudget)}`,
                  ],
                  [
                    "Cash required",
                    money(flip.cashRequired),
                    uw.financing === "all-cash"
                      ? "Same as all-in (all cash)"
                      : `Down ${uw.downPaymentPct}% of purchase (${money(uw.purchasePrice * (uw.downPaymentPct / 100))}) + closing + holding + rehab`,
                  ],
                  [
                    "% of ARV",
                    pct(flip.pctOfArv),
                    `${money(flip.allInAtRehab)} ÷ ${money(uw.arv)}`,
                  ],
                  [
                    "Cost of sale",
                    money(flip.costOfSale),
                    `${uw.costOfSalePct}% × ${money(uw.arv)}`,
                  ],
                  [
                    "Profit",
                    money(flip.projectedProfit),
                    `${money(uw.arv)} − ${money(flip.allInAtRehab)} − ${money(flip.costOfSale)}`,
                  ],
                ].map(([k, v, note]) => (
                  <div key={k as string}>
                    <div className="flex justify-between gap-4">
                      <dt className="text-steel">{k}</dt>
                      <dd className="font-medium text-ink">{v}</dd>
                    </div>
                    <p className="font-mono text-[10px] text-sage">{note}</p>
                  </div>
                ))}
              </dl>
              <p
                className={`mt-3 text-[11px] ${
                  flip.mathOk ? "text-sage" : "text-copper"
                }`}
              >
                {flip.mathOk
                  ? "Identity check: profit = ARV − all-in − cost of sale ✓"
                  : "Math identity failed — recheck inputs"}
              </p>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <div className="bg-forest px-3 py-3 text-paper">
                  <p className="text-[10px] uppercase tracking-wider text-mist">
                    Profit
                  </p>
                  <p className="mt-1 font-display text-xl">
                    {money(flip.projectedProfit)}
                  </p>
                </div>
                <div className="bg-limestone px-3 py-3">
                  <p className="text-[10px] uppercase tracking-wider text-sage">
                    ROI on cash
                  </p>
                  <p className="mt-1 font-display text-xl text-ink">
                    {pct(flip.roiOnCash)}
                  </p>
                  <p className="mt-1 font-mono text-[10px] text-sage">
                    {money(flip.projectedProfit)} ÷ {money(flip.cashRequired)}
                  </p>
                </div>
                <div className="bg-limestone px-3 py-3">
                  <p className="text-[10px] uppercase tracking-wider text-sage">
                    Annualized
                  </p>
                  <p className="mt-1 font-display text-xl text-ink">
                    {pct(flip.annualizedRoi)}
                  </p>
                  <p className="mt-1 font-mono text-[10px] text-sage">
                    {pct(flip.roiOnCash)} × 12 / {flip.monthsHeld} mo
                  </p>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Field label="Monthly rent (house / total doors)">
                  <input
                    type="number"
                    className={inputClass}
                    value={uw.monthlyRent}
                    onChange={(e) =>
                      patchUw({ monthlyRent: Number(e.target.value) || 0 })
                    }
                  />
                </Field>
                <Field label="Monthly expenses">
                  <input
                    type="number"
                    className={inputClass}
                    value={uw.monthlyExpenses}
                    onChange={(e) =>
                      patchUw({
                        monthlyExpenses: Number(e.target.value) || 0,
                      })
                    }
                  />
                </Field>
              </div>
              <dl className="mt-6 space-y-2 border-t border-line pt-5 text-sm">
                {[
                  ["All-in cost", money(rent.allInAtRehab)],
                  ["Cash required", money(rent.cashRequired)],
                  ["NOI monthly", money(rent.monthlyNoi)],
                  ["Sweat equity", money(rent.sweatEquity)],
                  ["Cash-on-cash", pct(rent.cashOnCash)],
                  ["Cap rate (cost)", pct(rent.capRateOnCost)],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4">
                    <dt className="text-steel">{k}</dt>
                    <dd className="font-medium text-ink">{v}</dd>
                  </div>
                ))}
              </dl>
            </>
          )}

          {projectHref && (
            <Link
              href={projectHref}
              className="mt-6 inline-flex text-sm font-medium text-copper hover:text-copper-deep"
            >
              Open full property record on this project →
            </Link>
          )}
        </div>
      </div>

      <CostItemizer
        scope={scope}
        items={uw.costItems ?? []}
        flatBudget={uw.rehabBudget}
        modelBudget={constructionFromModel}
        onChange={applyCostItems}
      />
    </div>
  );
}
