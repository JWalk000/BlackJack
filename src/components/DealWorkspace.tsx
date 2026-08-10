"use client";

import Link from "next/link";
import type { BuildMode, Deal, PropertyClass } from "@/lib/types";
import { DEFAULT_PROPERTY_TYPES } from "@/lib/types";
import { costsAreBlank, defaultClosingCosts, templateCostItems } from "@/lib/deals";
import { CostItemizer } from "./CostItemizer";
import { AddressLookup } from "./AddressLookup";
import { MarketCompsPanel } from "./MarketCompsPanel";
import { DealProjectPanel } from "./DealProjectPanel";
import { DealDecisionSnapshot } from "./DealDecisionSnapshot";
// import { DealExcelButtons } from "./DealExcelButtons"; // EXCEL_DEAL_IO — re-enable when ready
import {
  Field,
  MoneyInput,
  NumberInput,
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
  const types = DEFAULT_PROPERTY_TYPES[deal.propertyClass];

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
      <div
        className={`flex flex-col gap-3 border-b border-line sm:flex-row sm:items-end sm:justify-between ${
          tab === "project" || tab === "analysis" ? "pb-4" : "gap-5 pb-8"
        }`}
      >
        <div className="min-w-0">
          <p className="page-label">
            {deal.buildMode === "new_build" ? "Ground-up" : "Rehab"}
            {" · "}
            {deal.propertyClass}
            {deal.teamId ? " · Team deal" : ""}
          </p>
          <h1
            className={`page-title mt-1 break-words ${
              tab === "project" || tab === "analysis"
                ? "text-2xl sm:text-3xl"
                : "mt-2 text-3xl sm:text-5xl"
            }`}
          >
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

      <div
        className={`studio-tabs flex gap-0 overflow-x-auto overscroll-x-contain border-b border-line [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
          tab === "project" || tab === "analysis" ? "mt-4" : "mt-6"
        }`}
      >
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

      <div
        className={
          tab === "project" || tab === "analysis" ? "mt-5" : "mt-10"
        }
      >
        {tab === "property" ? (
          <div className="space-y-4">
            <div className="border-b border-line pb-3">
              <p className="page-label">Property</p>
              <h2 className="page-title mt-0.5 text-2xl sm:text-3xl">
                What are we underwriting?
              </h2>
              <p className="mt-1 max-w-lg text-sm text-muted">
                Identity and address first. Building SF drives exit $/sf on
                Final numbers.
              </p>
            </div>

            {/* 1 — Identity */}
            <section className="panel space-y-4 p-4 sm:p-5">
              <p className="page-label">1 · Deal</p>
              <Field label="Name">
                <input
                  className={inputClass}
                  value={deal.property.name}
                  onChange={(e) => patchProperty({ name: e.target.value })}
                  placeholder="e.g. Heights duplex rebuild"
                />
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
                    Build
                  </p>
                  <div className="grid grid-cols-2 gap-1">
                    {(
                      [
                        ["rehab", "Rehab"],
                        ["new_build", "Ground-up"],
                      ] as const
                    ).map(([id, label]) => (
                      <button
                        key={id}
                        type="button"
                        data-active={deal.buildMode === id}
                        onClick={() => applyScope({ buildMode: id })}
                        className="select-tile px-2 py-2 text-center text-xs font-semibold sm:text-sm"
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
                    Class
                  </p>
                  <div className="grid grid-cols-2 gap-1">
                    {(
                      [
                        ["residential", "Residential"],
                        ["commercial", "Commercial"],
                      ] as const
                    ).map(([id, label]) => (
                      <button
                        key={id}
                        type="button"
                        data-active={deal.propertyClass === id}
                        onClick={() =>
                          applyScope({
                            propertyClass: id,
                          })
                        }
                        className="select-tile px-2 py-2 text-center text-xs font-semibold sm:text-sm"
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <Field label="Notes (optional)">
                <textarea
                  className={`${inputClass} min-h-12`}
                  value={deal.property.description}
                  onChange={(e) =>
                    patchProperty({ description: e.target.value })
                  }
                  placeholder="Short note on the play…"
                />
              </Field>
            </section>

            {/* 2 — Location */}
            <section className="panel space-y-4 p-4 sm:p-5">
              <div>
                <p className="page-label">2 · Location</p>
                <p className="mt-0.5 text-sm text-muted">
                  Search street, then confirm city / state / zip.
                </p>
              </div>
              <AddressLookup
                property={deal.property}
                onStreetChange={(address) => patchProperty({ address })}
                onApply={(patch) => patchProperty(patch)}
              />
              <div className="grid gap-3 sm:grid-cols-6">
                <div className="sm:col-span-2">
                  <Field label="City">
                    <input
                      className={inputClass}
                      value={deal.property.city}
                      onChange={(e) => patchProperty({ city: e.target.value })}
                    />
                  </Field>
                </div>
                <div className="sm:col-span-1">
                  <Field label="State">
                    <input
                      className={inputClass}
                      value={deal.property.state}
                      onChange={(e) =>
                        patchProperty({ state: e.target.value })
                      }
                    />
                  </Field>
                </div>
                <div className="sm:col-span-1">
                  <Field label="Zip">
                    <input
                      className={inputClass}
                      value={deal.property.zip}
                      onChange={(e) => patchProperty({ zip: e.target.value })}
                    />
                  </Field>
                </div>
                <div className="sm:col-span-2">
                  <Field label="APN (optional)">
                    <input
                      className={inputClass}
                      value={deal.property.apn}
                      onChange={(e) => patchProperty({ apn: e.target.value })}
                    />
                  </Field>
                </div>
              </div>
            </section>

            {/* 3 — Physical */}
            <section className="panel space-y-4 p-4 sm:p-5">
              <div>
                <p className="page-label">3 · Size & layout</p>
                <p className="mt-0.5 text-sm text-muted">
                  Building square feet is the one field Final numbers needs for
                  exit $/sf.
                </p>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-3 border border-line bg-stone/20 p-3 sm:p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
                    Size
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Building sf">
                      <NumberInput
                        value={deal.property.buildingSf}
                        onChange={(buildingSf) =>
                          patchProperty({ buildingSf })
                        }
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
                        onChange={(yearBuilt) =>
                          patchProperty({ yearBuilt })
                        }
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
                  </div>
                </div>

                <div className="space-y-3 border border-line bg-stone/20 p-3 sm:p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
                    Layout
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
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
                    {deal.propertyClass === "residential" ? (
                      <>
                        <Field label="Bedrooms">
                          <NumberInput
                            value={deal.property.bedrooms}
                            onChange={(bedrooms) =>
                              patchProperty({ bedrooms })
                            }
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
                </div>
              </div>
            </section>

            <div className="flex justify-end pt-1">
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
          <div className="space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-2 border-b border-line pb-2">
              <div>
                <p className="page-label">Final numbers</p>
                <h2 className="page-title mt-0.5 text-2xl sm:text-3xl">
                  Underwrite the exit
                </h2>
              </div>
              <div className="grid grid-cols-2 gap-1">
                {(
                  [
                    ["flip", "Sell"],
                    ["hold", "Hold"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    data-active={deal.exitStrategy === id}
                    onClick={() => onChange({ ...deal, exitStrategy: id })}
                    className="select-tile px-3 py-1.5 text-center text-xs font-semibold"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Dense underwrite: 2–3 rows max on desktop */}
            <section className="panel space-y-2 p-2.5 sm:p-3">
              <p className="page-label">Underwrite</p>

              <div className="grid gap-x-2 gap-y-1.5 sm:grid-cols-12">
                <div className="sm:col-span-3">
                  <Field
                    compact
                    label={
                      deal.exitStrategy === "flip"
                        ? "Exit (ARV)"
                        : "Value (ARV)"
                    }
                  >
                    <MoneyInput
                      className="studio-input--dense"
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
                </div>
                <div className="sm:col-span-3">
                  <Field compact label="Closing (4% def.)">
                    <MoneyInput
                      className="studio-input--dense"
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
                <div className="sm:col-span-2">
                  <Field
                    compact
                    label={
                      deal.buildMode === "new_build" ? "Build mo" : "Rehab mo"
                    }
                  >
                    <NumberInput
                      className="studio-input--dense"
                      value={deal.assumptions.projectMonths}
                      onChange={(v) =>
                        patchAssumptions({ projectMonths: v ?? 0 })
                      }
                      min={1}
                    />
                  </Field>
                </div>
                {deal.exitStrategy === "flip" ? (
                  <>
                    <div className="sm:col-span-2">
                      <Field compact label="Sell mo">
                        <NumberInput
                          className="studio-input--dense"
                          value={deal.assumptions.monthsToSaleOrRent}
                          onChange={(v) =>
                            patchAssumptions({ monthsToSaleOrRent: v ?? 0 })
                          }
                          min={0}
                        />
                      </Field>
                    </div>
                    <div className="sm:col-span-2">
                      <Field compact label="Sale %">
                        <NumberInput
                          className="studio-input--dense"
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
                  </>
                ) : (
                  <>
                    <div className="sm:col-span-2">
                      <Field compact label="Rent / mo">
                        <MoneyInput
                          className="studio-input--dense"
                          value={deal.assumptions.grossRentMonthly}
                          onChange={(grossRentMonthly) =>
                            patchAssumptions({ grossRentMonthly })
                          }
                        />
                      </Field>
                    </div>
                    <div className="sm:col-span-2">
                      <Field compact label="OpEx / mo">
                        <MoneyInput
                          className="studio-input--dense"
                          value={deal.assumptions.operatingExpensesMonthly}
                          onChange={(operatingExpensesMonthly) =>
                            patchAssumptions({ operatingExpensesMonthly })
                          }
                        />
                      </Field>
                    </div>
                  </>
                )}

                <div
                  className={
                    deal.financing.style !== "all_cash"
                      ? "sm:col-span-5"
                      : "sm:col-span-12"
                  }
                >
                  <Field compact label="Financing">
                    <select
                      className={`${inputClass} studio-input--dense`}
                      value={deal.financing.style}
                      onChange={(e) =>
                        patchFinancing({
                          style: e.target.value as Deal["financing"]["style"],
                        })
                      }
                    >
                      <option value="all_cash">All cash</option>
                      <option value="hard_money">Hard money / private</option>
                      <option value="conventional">
                        Conventional / bank
                      </option>
                    </select>
                  </Field>
                </div>
                {deal.financing.style !== "all_cash" ? (
                  <>
                    <div className="sm:col-span-2">
                      <Field compact label="LTV %">
                        <NumberInput
                          className="studio-input--dense"
                          value={deal.financing.ltvPct}
                          onChange={(v) =>
                            patchFinancing({ ltvPct: v ?? 0 })
                          }
                          min={0}
                          max={100}
                        />
                      </Field>
                    </div>
                    <div className="sm:col-span-2">
                      <Field compact label="Rate %">
                        <NumberInput
                          className="studio-input--dense"
                          value={deal.financing.interestRatePct}
                          onChange={(v) =>
                            patchFinancing({ interestRatePct: v ?? 0 })
                          }
                          min={0}
                          step={0.125}
                        />
                      </Field>
                    </div>
                    <div className="sm:col-span-2">
                      <Field compact label="Pts %">
                        <NumberInput
                          className="studio-input--dense"
                          value={deal.financing.pointsPct}
                          onChange={(v) =>
                            patchFinancing({ pointsPct: v ?? 0 })
                          }
                          min={0}
                          step={0.25}
                        />
                      </Field>
                    </div>
                  </>
                ) : null}

                {deal.exitStrategy === "hold" ? (
                  <>
                    <div className="sm:col-span-2">
                      <Field compact label="Vacancy %">
                        <NumberInput
                          className="studio-input--dense"
                          value={deal.assumptions.vacancyPct}
                          onChange={(v) =>
                            patchAssumptions({ vacancyPct: v ?? 0 })
                          }
                          min={0}
                          max={100}
                        />
                      </Field>
                    </div>
                    <div className="sm:col-span-3">
                      <Field compact label="Other income">
                        <MoneyInput
                          className="studio-input--dense"
                          value={deal.assumptions.otherIncomeMonthly}
                          onChange={(otherIncomeMonthly) =>
                            patchAssumptions({ otherIncomeMonthly })
                          }
                        />
                      </Field>
                    </div>
                    <div className="sm:col-span-3">
                      <Field compact label="Refinance?">
                        <select
                          className={`${inputClass} studio-input--dense`}
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
                    </div>
                    {deal.assumptions.refinance ? (
                      <>
                        <div className="sm:col-span-2">
                          <Field compact label="Perm LTV">
                            <NumberInput
                              className="studio-input--dense"
                              value={deal.assumptions.permanentLtvPct}
                              onChange={(v) =>
                                patchAssumptions({ permanentLtvPct: v ?? 0 })
                              }
                              min={0}
                              max={100}
                            />
                          </Field>
                        </div>
                        <div className="sm:col-span-2">
                          <Field compact label="Perm rate">
                            <NumberInput
                              className="studio-input--dense"
                              value={deal.assumptions.permanentRatePct}
                              onChange={(v) =>
                                patchAssumptions({ permanentRatePct: v ?? 0 })
                              }
                              min={0}
                              step={0.125}
                            />
                          </Field>
                        </div>
                        <div className="sm:col-span-2">
                          <Field compact label="Term yrs">
                            <NumberInput
                              className="studio-input--dense"
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
                      </>
                    ) : null}
                  </>
                ) : null}
              </div>

            </section>

            <DealDecisionSnapshot
              deal={deal}
              packageHref={`/deals/${deal.id}/package`}
            />

            <MarketCompsPanel deal={deal} />

            <div className="flex flex-col-reverse items-stretch justify-between gap-2 sm:flex-row sm:flex-wrap sm:items-center">
              <button
                type="button"
                className="btn-forest w-full !min-h-10 sm:w-auto"
                onClick={() => goTab("costs")}
              >
                Previous: Itemized costs
              </button>
              <button
                type="button"
                className="btn-signal w-full !min-h-10 sm:w-auto"
                onClick={() => goTab("project")}
              >
                Next: Project
              </button>
            </div>
          </div>
        ) : null}

        {tab === "project" ? (
          <div className="space-y-3">
            <DealProjectPanel
              deal={deal}
              onChange={onChange}
              onGoToCosts={() => goTab("costs")}
            />
            <div className="flex flex-col-reverse items-stretch justify-between gap-2 border-t border-line pt-3 sm:flex-row sm:flex-wrap sm:items-center">
              <button
                type="button"
                className="btn-forest w-full !min-h-10 sm:w-auto"
                onClick={() => goTab("analysis")}
              >
                Previous: Final numbers
              </button>
              <a
                href={`/deals/${deal.id}/package`}
                className="btn-signal w-full !min-h-10 sm:w-auto"
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

