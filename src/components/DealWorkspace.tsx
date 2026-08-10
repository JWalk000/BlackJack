"use client";

import { useMemo } from "react";
import Link from "next/link";
import type { BuildMode, Deal, PropertyClass } from "@/lib/types";
import { DEFAULT_PROPERTY_TYPES } from "@/lib/types";
import { costsAreBlank, defaultClosingCosts, templateCostItems } from "@/lib/deals";
import { money, pct, underwrite } from "@/lib/underwriting";
import { CostItemizer } from "./CostItemizer";
import { AddressLookup } from "./AddressLookup";
import { MarketCompsPanel } from "./MarketCompsPanel";
import { DealProjectPanel } from "./DealProjectPanel";
import { DealBudgetStrip } from "./DealBudgetStrip";
import { DealDecisionSnapshot } from "./DealDecisionSnapshot";
// import { DealExcelButtons } from "./DealExcelButtons"; // EXCEL_DEAL_IO — re-enable when ready
import {
  Field,
  MoneyInput,
  NumberInput,
  Metric,
  inputClass,
} from "./ui";

type Tab = "property" | "costs" | "analysis" | "project";

export function DealWorkspace({
  deal,
  onChange,
  onSave,
  tab,
  onTab,
  saveStatus = "idle",
  onFlushSave,
  teamContext = null,
}: {
  deal: Deal;
  onChange: (deal: Deal) => void;
  onSave: () => void;
  tab: Tab;
  onTab: (t: Tab) => void;
  /** Quiet auto-save status shown next to Save. */
  saveStatus?: "idle" | "saving" | "saved" | "error";
  /** Flush pending auto-save (blur / tab change). */
  onFlushSave?: () => void;
  /** When set, user can share this deal with their team. */
  teamContext?: {
    teamId: string;
    teamName: string;
    isOwner: boolean;
  } | null;
}) {
  const result = useMemo(() => underwrite(deal), [deal]);
  const types = DEFAULT_PROPERTY_TYPES[deal.propertyClass];
  const buildingSf =
    deal.property.buildingSf != null && deal.property.buildingSf > 0
      ? deal.property.buildingSf
      : null;
  const exitPsf =
    buildingSf && deal.assumptions.arv > 0
      ? deal.assumptions.arv / buildingSf
      : null;
  const formatPsf = (n: number | null) =>
    n != null && Number.isFinite(n)
      ? `$${Math.round(n).toLocaleString("en-US")}/sf`
      : "—";

  function patchProperty(p: Partial<Deal["property"]>) {
    onChange({ ...deal, property: { ...deal.property, ...p } });
  }
  function patchAssumptions(a: Partial<Deal["assumptions"]>) {
    onChange({ ...deal, assumptions: { ...deal.assumptions, ...a } });
  }
  function patchFinancing(f: Partial<Deal["financing"]>) {
    onChange({ ...deal, financing: { ...deal.financing, ...f } });
  }

  function applyScope(next: {
    buildMode?: BuildMode;
    propertyClass?: PropertyClass;
  }) {
    const buildMode = next.buildMode ?? deal.buildMode;
    const propertyClass = next.propertyClass ?? deal.propertyClass;
    const firstType =
      next.propertyClass && next.propertyClass !== deal.propertyClass
        ? DEFAULT_PROPERTY_TYPES[next.propertyClass][0]
        : deal.property.propertyType;

    const shouldResetCosts = costsAreBlank(deal.costItems);
    onChange({
      ...deal,
      buildMode,
      propertyClass,
      property: {
        ...deal.property,
        propertyType: firstType,
      },
      costItems: shouldResetCosts
        ? templateCostItems(buildMode, propertyClass)
        : deal.costItems,
    });
  }

  function resetCostTemplate() {
    onChange({
      ...deal,
      costItems: templateCostItems(deal.buildMode, deal.propertyClass),
    });
  }

  function goTab(t: Tab) {
    onFlushSave?.();
    onTab(t);
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "property", label: "Property" },
    { id: "costs", label: "Itemized costs" },
    { id: "analysis", label: "Final numbers" },
    { id: "project", label: "Project" },
  ];

  const shortTab = (id: Tab) =>
    id === "property"
      ? "Property"
      : id === "costs"
        ? "Costs"
        : id === "analysis"
          ? "Numbers"
          : "Project";

  return (
    <div
      className="min-w-0"
      onBlur={(e) => {
        const next = e.relatedTarget as Node | null;
        if (next && e.currentTarget.contains(next)) return;
        onFlushSave?.();
      }}
    >
      <div className="flex flex-col gap-5 border-b border-line pb-8 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="page-label">
            {deal.buildMode === "new_build" ? "Ground-up" : "Rehab"}
            {" · "}
            {deal.propertyClass}
            {deal.teamId ? " · Team deal" : ""}
          </p>
          <h1 className="page-title mt-2 break-words text-3xl sm:text-5xl">
            {deal.property.name.trim() ||
              deal.property.address.trim() ||
              "Untitled deal"}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {teamContext ? (
            <label className="flex min-h-11 w-full cursor-pointer items-center gap-2 border border-line bg-stone/40 px-3 py-2 text-sm sm:w-auto">
              <input
                type="checkbox"
                className="size-4 accent-[var(--forest)]"
                checked={deal.teamId === teamContext.teamId}
                onChange={(e) => {
                  onChange({
                    ...deal,
                    teamId: e.target.checked ? teamContext.teamId : null,
                  });
                }}
              />
              <span className="font-medium text-ink">
                Share with {teamContext.teamName}
              </span>
            </label>
          ) : (
            <Link
              href="/team"
              className="inline-flex min-h-11 items-center text-sm font-medium text-muted transition hover:text-signal"
            >
              Team sharing
            </Link>
          )}
          {saveStatus === "saving" ? (
            <span className="text-sm text-muted" aria-live="polite">
              Saving…
            </span>
          ) : saveStatus === "saved" ? (
            <span className="text-sm font-semibold text-profit" aria-live="polite">
              Saved
            </span>
          ) : saveStatus === "error" ? (
            <span className="text-sm text-muted" aria-live="polite">
              Saved locally
            </span>
          ) : null}
          {/* EXCEL_DEAL_IO — re-enable when ready
          <DealExcelButtons
            deal={deal}
            replaceId={deal.id}
            onImported={(next) => onChange(next)}
            compact
          />
          */}
          <button type="button" onClick={onSave} className="btn-signal w-full sm:w-auto">
            Save deal
          </button>
        </div>
      </div>

      <div className="studio-tabs mt-6 flex gap-0 overflow-x-auto overscroll-x-contain border-b border-line [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              goTab(t.id);
            }}
            className={`min-h-14 shrink-0 border-b-2 px-5 py-4 text-lg font-medium leading-snug tracking-wide transition sm:min-h-12 sm:px-6 sm:py-4 ${
              tab === t.id
                ? "border-signal text-ink"
                : "border-transparent text-muted hover:text-ink"
            }`}
          >
            <span className="whitespace-normal sm:hidden">
              {shortTab(t.id)}
            </span>
            <span className="hidden whitespace-normal sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      <div className="mt-10">
        {tab === "property" ? (
          <div className="space-y-8">
            <div className="grid items-start gap-10 lg:grid-cols-2">
              <section className="panel space-y-5 p-5 sm:p-7">
                <div>
                  <p className="page-label">Section</p>
                  <h2 className="mt-2 font-display text-2xl tracking-tight text-ink sm:text-3xl">
                    Identity
                  </h2>
                </div>
                <Field label="Deal / property name">
                  <input
                    className={inputClass}
                    value={deal.property.name}
                    onChange={(e) => patchProperty({ name: e.target.value })}
                    placeholder="e.g. Heights duplex rebuild"
                  />
                </Field>
                <Field label="Description">
                  <textarea
                    className={`${inputClass} min-h-24`}
                    value={deal.property.description}
                    onChange={(e) =>
                      patchProperty({ description: e.target.value })
                    }
                  />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Build type">
                    <select
                      className={inputClass}
                      value={deal.buildMode}
                      onChange={(e) =>
                        applyScope({
                          buildMode: e.target.value as Deal["buildMode"],
                        })
                      }
                    >
                      <option value="rehab">Rehab / renovation</option>
                      <option value="new_build">Ground-up build</option>
                    </select>
                  </Field>
                  <Field label="Residential or commercial">
                    <select
                      className={inputClass}
                      value={deal.propertyClass}
                      onChange={(e) =>
                        applyScope({
                          propertyClass: e.target
                            .value as Deal["propertyClass"],
                        })
                      }
                    >
                      <option value="residential">Residential</option>
                      <option value="commercial">Commercial</option>
                    </select>
                  </Field>
                </div>
                <AddressLookup
                  property={deal.property}
                  onStreetChange={(address) => patchProperty({ address })}
                  onApply={(patch) => patchProperty(patch)}
                />
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label="City">
                    <input
                      className={inputClass}
                      value={deal.property.city}
                      onChange={(e) => patchProperty({ city: e.target.value })}
                    />
                  </Field>
                  <Field label="State">
                    <input
                      className={inputClass}
                      value={deal.property.state}
                      onChange={(e) => patchProperty({ state: e.target.value })}
                    />
                  </Field>
                  <Field label="Zip">
                    <input
                      className={inputClass}
                      value={deal.property.zip}
                      onChange={(e) => patchProperty({ zip: e.target.value })}
                    />
                  </Field>
                </div>
                <Field label="APN">
                  <input
                    className={inputClass}
                    value={deal.property.apn}
                    onChange={(e) => patchProperty({ apn: e.target.value })}
                  />
                </Field>
              </section>

              <section className="panel space-y-5 p-5 sm:p-7">
                <div>
                  <p className="page-label">Section</p>
                  <h2 className="mt-2 font-display text-2xl tracking-tight text-ink sm:text-3xl">
                    Physical
                  </h2>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Property type">
                    <select
                      className={inputClass}
                      value={deal.property.propertyType}
                      onChange={(e) =>
                        patchProperty({ propertyType: e.target.value })
                      }
                    >
                      {types.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Condition">
                    <input
                      className={inputClass}
                      value={deal.property.condition}
                      onChange={(e) =>
                        patchProperty({ condition: e.target.value })
                      }
                    />
                  </Field>
                  <Field label="Building sf">
                    <NumberInput
                      value={deal.property.buildingSf}
                      onChange={(buildingSf) => patchProperty({ buildingSf })}
                      min={0}
                      step={50}
                    />
                  </Field>
                  <Field label="Lot sf">
                    <NumberInput
                      value={deal.property.lotSf}
                      onChange={(lotSf) => patchProperty({ lotSf })}
                      min={0}
                      step={100}
                    />
                  </Field>
                  <Field label="Year built">
                    <NumberInput
                      value={deal.property.yearBuilt}
                      onChange={(yearBuilt) => patchProperty({ yearBuilt })}
                      min={1800}
                      max={2100}
                    />
                  </Field>
                  <Field label="Units">
                    <NumberInput
                      value={deal.property.units}
                      onChange={(units) => patchProperty({ units })}
                      min={0}
                    />
                  </Field>
                  {deal.propertyClass === "residential" ? (
                    <>
                      <Field label="Bedrooms">
                        <NumberInput
                          value={deal.property.bedrooms}
                          onChange={(bedrooms) => patchProperty({ bedrooms })}
                          min={0}
                        />
                      </Field>
                      <Field label="Full baths">
                        <NumberInput
                          value={deal.property.bathsFull}
                          onChange={(bathsFull) =>
                            patchProperty({ bathsFull })
                          }
                          min={0}
                          step={0.5}
                        />
                      </Field>
                    </>
                  ) : (
                    <>
                      <Field label="Floors">
                        <NumberInput
                          value={deal.property.floors}
                          onChange={(floors) => patchProperty({ floors })}
                          min={0}
                        />
                      </Field>
                      <Field label="Zoning">
                        <input
                          className={inputClass}
                          value={deal.property.zoning}
                          onChange={(e) =>
                            patchProperty({ zoning: e.target.value })
                          }
                        />
                      </Field>
                    </>
                  )}
                </div>
              </section>
            </div>
            <div className="flex flex-col gap-3 border-t border-line pt-6 sm:flex-row sm:justify-end">
              <button
                type="button"
                className="btn-signal w-full sm:w-auto"
                onClick={() => goTab("costs")}
              >
                Next: Itemized costs
              </button>
            </div>
          </div>
        ) : null}

        {tab === "costs" ? (
          <div className="space-y-8">
            <CostItemizer
              deal={deal}
              onChange={onChange}
              onResetTemplate={resetCostTemplate}
            />
            <div className="flex flex-col-reverse items-stretch justify-between gap-3 border-t border-line pt-6 sm:flex-row sm:flex-wrap sm:items-center">
              <button
                type="button"
                className="btn-forest w-full sm:w-auto"
                onClick={() => goTab("property")}
              >
                Previous: Property
              </button>
              <button
                type="button"
                className="btn-signal w-full sm:w-auto"
                onClick={() => goTab("analysis")}
              >
                Next: Final numbers
              </button>
            </div>
          </div>
        ) : null}

        {tab === "analysis" ? (
          <div className="space-y-8">
            <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-6">
              <div>
                <p className="page-label">Analysis</p>
                <h2 className="page-title mt-2 text-3xl sm:text-4xl">
                  Final numbers
                </h2>
                <p className="mt-2 max-w-xl text-sm text-muted">
                  Decision first, then assumptions and full results. Same budget
                  strip as Costs — bank package opens from here.
                </p>
              </div>
            </div>

            <DealDecisionSnapshot
              deal={deal}
              packageHref={`/deals/${deal.id}/package`}
            />

            <DealBudgetStrip
              deal={deal}
              mode="summary"
              onGoToCosts={() => goTab("costs")}
            />

            <MarketCompsPanel deal={deal} />

          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
            <section className="panel space-y-6 p-5 sm:p-7">
              <div>
                <p className="page-label">Assumptions</p>
                <h2 className="mt-2 font-display text-2xl tracking-tight text-ink sm:text-3xl">
                  Exit value, timeline, financing
                </h2>
              </div>

              <div className="space-y-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
                  Exit value
                </p>
                <Field
                  label={
                    deal.exitStrategy === "flip"
                      ? "After-repair / exit value (ARV)"
                      : "Stabilized value (ARV)"
                  }
                >
                  <MoneyInput
                    value={deal.assumptions.arv}
                    onChange={(arv) => {
                      const next: Partial<typeof deal.assumptions> = { arv };
                      if (!deal.assumptions.closingCostsManual) {
                        next.closingCosts = defaultClosingCosts(arv);
                      }
                      patchAssumptions(next);
                    }}
                  />
                </Field>
                <Field
                  label="Closing costs"
                  hint="Defaults to 4% of exit value — edit to override"
                >
                  <MoneyInput
                    value={
                      deal.assumptions.closingCostsManual
                        ? deal.assumptions.closingCosts
                        : defaultClosingCosts(deal.assumptions.arv)
                    }
                    onChange={(closingCosts) =>
                      patchAssumptions({
                        closingCosts,
                        closingCostsManual: true,
                      })
                    }
                  />
                </Field>
              </div>

              <div className="space-y-4 border-t border-line pt-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
                  Build budget roll-up
                </p>
                <div className="flex min-w-0 items-center justify-between gap-3 border border-signal/25 bg-signal/10 px-4 py-3.5">
                  <span className="shrink-0 text-sm text-muted">
                    From itemized costs
                  </span>
                  <span className="min-w-0 break-all text-right font-display text-xl tracking-tight text-ink sm:text-2xl">
                    {money(result.buildBudget)}
                  </span>
                </div>
                <Field
                  label={
                    deal.buildMode === "new_build"
                      ? "Build period (months)"
                      : "Rehab period (months)"
                  }
                >
                  <NumberInput
                    value={deal.assumptions.projectMonths}
                    onChange={(v) =>
                      patchAssumptions({ projectMonths: v ?? 0 })
                    }
                    min={1}
                  />
                </Field>
              </div>

              <div className="space-y-4 border-t border-line pt-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
                  Financing
                </p>
                <Field label="Financing style">
                  <select
                    className={inputClass}
                    value={deal.financing.style}
                    onChange={(e) =>
                      patchFinancing({
                        style: e.target.value as Deal["financing"]["style"],
                      })
                    }
                  >
                    <option value="all_cash">All cash</option>
                    <option value="hard_money">Hard money / private</option>
                    <option value="conventional">Conventional / bank</option>
                  </select>
                </Field>
                {deal.financing.style !== "all_cash" ? (
                  <div className="grid gap-4 sm:grid-cols-3">
                    <Field label="LTV %">
                      <NumberInput
                        value={deal.financing.ltvPct}
                        onChange={(v) =>
                          patchFinancing({ ltvPct: v ?? 0 })
                        }
                        min={0}
                        max={100}
                      />
                    </Field>
                    <Field label="Rate %">
                      <NumberInput
                        value={deal.financing.interestRatePct}
                        onChange={(v) =>
                          patchFinancing({ interestRatePct: v ?? 0 })
                        }
                        min={0}
                        step={0.125}
                      />
                    </Field>
                    <Field label="Points %">
                      <NumberInput
                        value={deal.financing.pointsPct}
                        onChange={(v) =>
                          patchFinancing({ pointsPct: v ?? 0 })
                        }
                        min={0}
                        step={0.25}
                      />
                    </Field>
                  </div>
                ) : null}
              </div>
            </section>

            <section className="space-y-6">
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    ["flip", "Sell"],
                    ["hold", "Hold / rent"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    data-active={deal.exitStrategy === id}
                    onClick={() => onChange({ ...deal, exitStrategy: id })}
                    className="select-tile px-3 py-3 text-center text-sm font-semibold"
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <Metric label="All-in cost" value={money(result.totalAllIn)} />
                <Metric
                  label="Cash required"
                  value={money(result.cashRequired)}
                  tone="accent"
                />
                <Metric
                  label="% of ARV"
                  value={pct(result.pctOfArv)}
                />
              </div>

              {deal.exitStrategy === "flip" ? (
                <div className="panel space-y-5 p-5 sm:p-7">
                  <div>
                    <p className="page-label">Exit path</p>
                    <h2 className="mt-2 font-display text-2xl tracking-tight text-ink sm:text-3xl">
                      Sell analysis
                    </h2>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Months to sell (after work)">
                      <NumberInput
                        value={deal.assumptions.monthsToSaleOrRent}
                        onChange={(v) =>
                          patchAssumptions({
                            monthsToSaleOrRent: v ?? 0,
                          })
                        }
                        min={0}
                      />
                    </Field>
                    <Field label="Cost of sale %">
                      <NumberInput
                        value={deal.assumptions.costOfSalePct}
                        onChange={(v) =>
                          patchAssumptions({ costOfSalePct: v ?? 0 })
                        }
                        min={0}
                        max={20}
                        step={0.25}
                      />
                    </Field>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Metric
                      label="Exit $/sf"
                      value={formatPsf(exitPsf)}
                      tone="accent"
                    />
                    <Metric
                      label="Cost of sale"
                      value={money(result.costOfSale)}
                    />
                    <Metric
                      label="Net sale proceeds"
                      value={money(result.netSaleProceeds)}
                    />
                  </div>
                  {!buildingSf ? (
                    <p className="text-xs text-muted">
                      Set building square feet on the Property tab to calculate
                      exit $/sf.
                    </p>
                  ) : (
                    <p className="text-xs text-muted">
                      Exit $/sf = exit value ÷{" "}
                      {buildingSf.toLocaleString("en-US")} building sf
                      (Property).
                    </p>
                  )}
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Metric
                      label="Projected profit"
                      value={money(result.flipProfit)}
                      tone={result.flipProfit >= 0 ? "profit" : "loss"}
                    />
                    <Metric
                      label="ROI on cash"
                      value={pct(result.flipRoiOnCash)}
                      tone={result.flipRoiOnCash >= 0 ? "profit" : "loss"}
                    />
                    <Metric
                      label="ROI annualized"
                      value={pct(result.flipRoiAnnualized)}
                      tone={
                        result.flipRoiAnnualized >= 0 ? "profit" : "loss"
                      }
                    />
                  </div>
                  <p className="text-xs leading-relaxed text-muted">
                    Profit = exit value − cost of sale − all-in (closing +
                    itemized build + short-term finance cost). ROI uses cash
                    required.
                  </p>
                </div>
              ) : (
                <div className="panel space-y-5 p-5 sm:p-7">
                  <div>
                    <p className="page-label">Exit path</p>
                    <h2 className="mt-2 font-display text-2xl tracking-tight text-ink sm:text-3xl">
                      Hold / rent analysis
                    </h2>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Gross rent / mo">
                      <MoneyInput
                        value={deal.assumptions.grossRentMonthly}
                        onChange={(grossRentMonthly) =>
                          patchAssumptions({ grossRentMonthly })
                        }
                      />
                    </Field>
                    <Field label="Other income / mo">
                      <MoneyInput
                        value={deal.assumptions.otherIncomeMonthly}
                        onChange={(otherIncomeMonthly) =>
                          patchAssumptions({ otherIncomeMonthly })
                        }
                      />
                    </Field>
                    <Field label="Vacancy %">
                      <NumberInput
                        value={deal.assumptions.vacancyPct}
                        onChange={(v) =>
                          patchAssumptions({ vacancyPct: v ?? 0 })
                        }
                        min={0}
                        max={100}
                      />
                    </Field>
                    <Field label="OpEx / mo">
                      <MoneyInput
                        value={deal.assumptions.operatingExpensesMonthly}
                        onChange={(operatingExpensesMonthly) =>
                          patchAssumptions({ operatingExpensesMonthly })
                        }
                      />
                    </Field>
                  </div>

                  <Field label="Refinance into permanent debt?">
                    <select
                      className={inputClass}
                      value={deal.assumptions.refinance ? "yes" : "no"}
                      onChange={(e) =>
                        patchAssumptions({
                          refinance: e.target.value === "yes",
                        })
                      }
                    >
                      <option value="no">No</option>
                      <option value="yes">Yes</option>
                    </select>
                  </Field>
                  {deal.assumptions.refinance ? (
                    <div className="grid gap-4 sm:grid-cols-3">
                      <Field label="Permanent LTV %">
                        <NumberInput
                          value={deal.assumptions.permanentLtvPct}
                          onChange={(v) =>
                            patchAssumptions({ permanentLtvPct: v ?? 0 })
                          }
                          min={0}
                          max={100}
                        />
                      </Field>
                      <Field label="Rate %">
                        <NumberInput
                          value={deal.assumptions.permanentRatePct}
                          onChange={(v) =>
                            patchAssumptions({ permanentRatePct: v ?? 0 })
                          }
                          min={0}
                          step={0.125}
                        />
                      </Field>
                      <Field label="Term (years)">
                        <NumberInput
                          value={deal.assumptions.permanentTermYears}
                          onChange={(v) =>
                            patchAssumptions({
                              permanentTermYears: v ?? 0,
                            })
                          }
                          min={1}
                        />
                      </Field>
                    </div>
                  ) : null}

                  <div className="grid gap-3 sm:grid-cols-2">
                    <Metric
                      label="NOI / mo"
                      value={money(result.noiMonthly)}
                      tone={result.noiMonthly >= 0 ? "profit" : "loss"}
                    />
                    <Metric
                      label="Cash flow / mo"
                      value={money(result.cashFlowMonthly)}
                      tone={result.cashFlowMonthly >= 0 ? "profit" : "loss"}
                    />
                    <Metric
                      label="Sweat equity"
                      value={money(result.sweatEquity)}
                      tone={result.sweatEquity >= 0 ? "profit" : "loss"}
                    />
                    <Metric
                      label="Cash-on-cash"
                      value={pct(result.cashOnCashAnnual)}
                      tone={
                        result.cashOnCashAnnual >= 0 ? "profit" : "loss"
                      }
                    />
                    <Metric
                      label="Cap rate on cost"
                      value={pct(result.capRateOnCost)}
                    />
                    <Metric
                      label="Cap rate on ARV"
                      value={pct(result.capRateOnArv)}
                    />
                  </div>
                </div>
              )}
            </section>
          </div>
            <div className="flex flex-col-reverse items-stretch justify-between gap-3 border-t border-line pt-6 sm:flex-row sm:flex-wrap sm:items-center">
              <button
                type="button"
                className="btn-forest w-full sm:w-auto"
                onClick={() => goTab("costs")}
              >
                Previous: Itemized costs
              </button>
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                <a
                  href={`/deals/${deal.id}/package`}
                  className="btn-ghost w-full sm:w-auto"
                >
                  Open bank package
                </a>
                <button
                  type="button"
                  className="btn-signal w-full sm:w-auto"
                  onClick={() => goTab("project")}
                >
                  Next: Project
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {tab === "project" ? (
          <div className="space-y-8">
            <DealProjectPanel
              deal={deal}
              onChange={onChange}
              onGoToCosts={() => goTab("costs")}
            />
            <div className="flex flex-col-reverse items-stretch justify-between gap-3 border-t border-line pt-6 sm:flex-row sm:flex-wrap sm:items-center">
              <button
                type="button"
                className="btn-forest w-full sm:w-auto"
                onClick={() => goTab("analysis")}
              >
                Previous: Final numbers
              </button>
              <a
                href={`/deals/${deal.id}/package`}
                className="btn-signal w-full sm:w-auto"
              >
                Open bank package
              </a>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
