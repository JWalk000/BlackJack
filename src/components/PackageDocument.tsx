"use client";

import type { CostItem, Deal } from "@/lib/types";
import { COST_CATEGORY_ORDER } from "@/lib/types";
import { dealTitle } from "@/lib/deals";
import { money, pct, underwrite } from "@/lib/underwriting";
import { BRAND_NAME } from "@/lib/brand";

function groupCosts(items: CostItem[]) {
  const map = new Map<string, CostItem[]>();
  for (const item of items) {
    const key = item.category || "Other";
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(item);
  }
  const order = COST_CATEGORY_ORDER as readonly string[];
  const keys = [...map.keys()].sort((a, b) => {
    const ia = order.indexOf(a);
    const ib = order.indexOf(b);
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib) || a.localeCompare(b);
  });
  return keys.map((category) => ({
    category,
    items: map.get(category)!,
    subtotal: map.get(category)!.reduce((s, i) => s + (Number(i.amount) || 0), 0),
  }));
}

function SnapshotCell({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex justify-between gap-3 border-b border-[#e8e4dc] px-3 py-2.5 last:border-b-0 sm:block sm:border-b-0 sm:border-r sm:border-[#e8e4dc] sm:last:border-r-0">
      <dt className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[#666]">
        {label}
      </dt>
      <dd className="text-sm font-medium text-[#111] sm:mt-0.5">{value}</dd>
    </div>
  );
}

export function PackageDocument({
  deal,
  shared,
  generatedAt,
}: {
  deal: Deal;
  /** Public share view (no edit affordances beyond print). */
  shared?: boolean;
  generatedAt?: string;
}) {
  const result = underwrite(deal);
  const groups = groupCosts(deal.costItems);
  const title = dealTitle(deal);
  const p = deal.property;
  const addressLine = [
    p.address,
    [p.city, p.state, p.zip].filter(Boolean).join(", "),
  ]
    .filter(Boolean)
    .join(" · ");

  const printed = new Date(
    generatedAt || Date.now(),
  ).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const buildLabel =
    deal.buildMode === "new_build" ? "Ground-up construction" : "Rehab / renovation";
  const classLabel =
    deal.propertyClass === "commercial" ? "Commercial" : "Residential";

  const baths =
    p.bathsFull != null
      ? p.bathsHalf
        ? `${p.bathsFull} / ${p.bathsHalf}`
        : String(p.bathsFull)
      : "—";

  return (
    <article className="package-sheet mx-auto max-w-[8.5in] px-5 py-8 sm:px-8 sm:py-10 print:max-w-none print:px-0 print:py-0">
      {/* Cover / identity */}
      <header className="package-break-avoid border-b-2 border-[#111] pb-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="font-display text-3xl tracking-tight text-[#111]">
              {BRAND_NAME}
            </p>
            <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#444]">
              Construction / acquisition package
            </p>
          </div>
          <div className="text-right text-sm text-[#444]">
            <p className="font-medium text-[#111]">Prepared {printed}</p>
            <p className="mt-0.5 text-xs">
              {shared ? "Shared for lending review" : "For lending review"}
            </p>
            <p className="mt-2 inline-block border border-[#111] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em]">
              Confidential
            </p>
          </div>
        </div>

        <div className="mt-6">
          <h1 className="font-display text-[1.75rem] leading-tight tracking-tight text-[#111] sm:text-3xl">
            {title}
          </h1>
          {addressLine ? (
            <p className="mt-2 text-base text-[#333]">{addressLine}</p>
          ) : (
            <p className="mt-2 text-sm italic text-[#777]">
              Address not set — complete property identity before submitting.
            </p>
          )}
        </div>

        <dl className="mt-5 grid border border-[#ccc] bg-white sm:grid-cols-4">
          <SnapshotCell label="Project type" value={buildLabel} />
          <SnapshotCell label="Asset class" value={classLabel} />
          <SnapshotCell
            label="Product"
            value={p.propertyType || "—"}
          />
          <SnapshotCell
            label="Exit strategy"
            value={deal.exitStrategy === "flip" ? "Sell" : "Hold / rent"}
          />
        </dl>
      </header>

      {/* Property snapshot for lenders */}
      <section className="package-break-avoid mt-6">
        <h2 className="border-b border-[#111] pb-1 font-display text-xl text-[#111]">
          Property snapshot
        </h2>
        <dl className="mt-3 grid border border-[#ccc] bg-white sm:grid-cols-3">
          <SnapshotCell
            label="Building SF"
            value={
              p.buildingSf != null ? p.buildingSf.toLocaleString() : "—"
            }
          />
          <SnapshotCell
            label="Lot SF"
            value={p.lotSf != null ? p.lotSf.toLocaleString() : "—"}
          />
          <SnapshotCell
            label="Year built"
            value={p.yearBuilt != null ? String(p.yearBuilt) : "—"}
          />
          {deal.propertyClass === "residential" ? (
            <>
              <SnapshotCell
                label="Bedrooms"
                value={p.bedrooms != null ? String(p.bedrooms) : "—"}
              />
              <SnapshotCell label="Full baths" value={baths} />
              <SnapshotCell
                label="Units"
                value={p.units != null ? String(p.units) : "—"}
              />
            </>
          ) : (
            <>
              <SnapshotCell
                label="Floors"
                value={p.floors != null ? String(p.floors) : "—"}
              />
              <SnapshotCell label="Zoning" value={p.zoning || "—"} />
              <SnapshotCell
                label="Units"
                value={p.units != null ? String(p.units) : "—"}
              />
            </>
          )}
          <SnapshotCell
            label="Tax assessment"
            value={
              p.taxAssessment != null && p.taxAssessment > 0
                ? money(p.taxAssessment)
                : "—"
            }
          />
          <SnapshotCell
            label="Annual tax"
            value={
              p.taxAmount != null && p.taxAmount > 0
                ? money(p.taxAmount)
                : "—"
            }
          />
          <SnapshotCell label="APN / account" value={p.apn || "—"} />
          {p.condition ? (
            <SnapshotCell label="Condition" value={p.condition} />
          ) : null}
          {p.lastSaleAmount != null && p.lastSaleAmount > 0 ? (
            <SnapshotCell
              label="Last sale"
              value={`${money(p.lastSaleAmount)}${
                p.lastSaleDate ? ` · ${p.lastSaleDate}` : ""
              }`}
            />
          ) : null}
        </dl>
        {p.description ? (
          <p className="mt-3 text-sm leading-relaxed text-[#444]">
            {p.description}
          </p>
        ) : null}
      </section>

      <section className="package-break-avoid mt-8">
        <h2 className="border-b border-[#111] pb-1 font-display text-xl text-[#111]">
          Final numbers at a glance
        </h2>
        <div className="mt-3 grid grid-cols-2 gap-px border border-[#ccc] bg-[#ccc] sm:grid-cols-4">
          {[
            ["Build / rehab budget", money(result.buildBudget)],
            ["Total all-in", money(result.totalAllIn)],
            ["Cash required", money(result.cashRequired)],
            ["ARV / exit value", money(deal.assumptions.arv)],
            ["% of ARV", pct(result.pctOfArv)],
            ["Short-term loan", money(result.loanAmount)],
            ...(deal.exitStrategy === "flip"
              ? [
                  ["Projected profit", money(result.flipProfit)],
                  ["ROI on cash", pct(result.flipRoiOnCash)],
                ]
              : [
                  ["NOI (annual)", money(result.noiAnnual)],
                  ["Cash flow / mo", money(result.cashFlowMonthly)],
                ]),
          ].map(([label, value]) => (
            <div key={label} className="bg-white px-3 py-3">
              <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[#666]">
                {label}
              </p>
              <p className="mt-1 font-display text-lg text-[#111]">{value}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="package-break-avoid mt-8">
        <h2 className="border-b border-[#111] pb-1 font-display text-xl text-[#111]">
          Exit value &amp; financing
        </h2>
        <table className="mt-3 w-full border-collapse text-sm">
          <tbody>
            {(
              [
                ["After-repair / exit value (ARV)", money(deal.assumptions.arv)],
                ["Closing costs", money(deal.assumptions.closingCosts)],
                [
                  deal.buildMode === "new_build"
                    ? "Build period (months)"
                    : "Rehab period (months)",
                  String(deal.assumptions.projectMonths),
                ],
                [
                  "Financing",
                  deal.financing.style === "all_cash"
                    ? "All cash"
                    : `${deal.financing.style.replace("_", " ")} · ${deal.financing.ltvPct}% LTV · ${deal.financing.interestRatePct}% · ${deal.financing.pointsPct} pts`,
                ],
                ["Estimated financing cost", money(result.financingCost)],
                ...(deal.exitStrategy === "flip"
                  ? [
                      [
                        "Cost of sale",
                        `${deal.assumptions.costOfSalePct}% · ${money(result.costOfSale)}`,
                      ],
                      [
                        "Months to sell (after work)",
                        String(deal.assumptions.monthsToSaleOrRent),
                      ],
                    ]
                  : [
                      [
                        "Gross rent / mo",
                        money(deal.assumptions.grossRentMonthly),
                      ],
                      [
                        "OpEx / mo",
                        money(deal.assumptions.operatingExpensesMonthly),
                      ],
                      ["Vacancy", `${deal.assumptions.vacancyPct}%`],
                    ]),
              ] as [string, string][]
            ).map(([k, v]) => (
              <tr key={k} className="border-b border-[#ddd]">
                <td className="py-2 pr-4 text-[#555]">{k}</td>
                <td className="py-2 text-right font-medium text-[#111]">{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="mt-8">
        <h2 className="package-break-avoid border-b border-[#111] pb-1 font-display text-xl text-[#111]">
          Itemized cost breakdown
        </h2>
        <p className="mt-2 text-xs text-[#555]">
          Line items as entered by sponsor. Category subtotals and project total
          below.
        </p>

        {groups.map((g) => (
          <div key={g.category} className="package-break-avoid mt-5">
            <h3 className="flex items-baseline justify-between gap-4 border-b border-[#999] pb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#333]">
              <span>{g.category}</span>
              <span className="normal-case tracking-normal">
                {money(g.subtotal)}
              </span>
            </h3>
            <table className="mt-1 w-full border-collapse text-sm">
              <tbody>
                {g.items.map((item) => (
                  <tr key={item.id} className="border-b border-[#eee]">
                    <td className="py-1.5 pr-3 text-[#222]">
                      {item.label}
                      {item.notes ? (
                        <span className="mt-0.5 block text-[11px] text-[#777]">
                          {item.notes}
                        </span>
                      ) : null}
                    </td>
                    <td className="py-1.5 text-right tabular-nums text-[#111]">
                      {money(item.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}

        <div className="package-break-avoid mt-4 flex items-center justify-between border-t-2 border-[#111] pt-3">
          <span className="text-sm font-semibold uppercase tracking-[0.12em]">
            Total itemized budget
          </span>
          <span className="font-display text-2xl">{money(result.buildBudget)}</span>
        </div>
      </section>

      <section className="package-break-avoid mt-8">
        <h2 className="border-b border-[#111] pb-1 font-display text-xl text-[#111]">
          {deal.exitStrategy === "flip"
            ? "Sell economics"
            : "Hold / rent economics"}
        </h2>
        {deal.exitStrategy === "flip" ? (
          <table className="mt-3 w-full border-collapse text-sm">
            <tbody>
              {(
                [
                  ["Net sale proceeds", money(result.netSaleProceeds)],
                  ["Total all-in basis", money(result.totalAllIn)],
                  ["Projected profit", money(result.flipProfit)],
                  ["ROI on cash invested", pct(result.flipRoiOnCash)],
                  ["ROI annualized", pct(result.flipRoiAnnualized)],
                  ["Hold months (work + sell)", String(result.monthsTotal)],
                ] as [string, string][]
              ).map(([k, v]) => (
                <tr key={k} className="border-b border-[#ddd]">
                  <td className="py-2 pr-4 text-[#555]">{k}</td>
                  <td className="py-2 text-right font-medium">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="mt-3 w-full border-collapse text-sm">
            <tbody>
              {(
                [
                  ["Effective gross income / mo", money(result.egiMonthly)],
                  ["NOI / mo", money(result.noiMonthly)],
                  ["NOI annual", money(result.noiAnnual)],
                  ["Cash flow / mo", money(result.cashFlowMonthly)],
                  ["Cash-on-cash (annual)", pct(result.cashOnCashAnnual)],
                  ["Sweat equity (ARV − all-in)", money(result.sweatEquity)],
                  ["Cap rate on cost", pct(result.capRateOnCost)],
                  ["Cap rate on ARV", pct(result.capRateOnArv)],
                ] as [string, string][]
              ).map(([k, v]) => (
                <tr key={k} className="border-b border-[#ddd]">
                  <td className="py-2 pr-4 text-[#555]">{k}</td>
                  <td className="py-2 text-right font-medium">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <footer className="package-break-avoid mt-10 border-t border-[#ccc] pt-4 text-[11px] leading-relaxed text-[#666]">
        <p className="font-semibold uppercase tracking-[0.1em] text-[#444]">
          Disclaimer
        </p>
        <p className="mt-2">
          Generated by {BRAND_NAME} · not an MLS listing, appraisal, or lending
          commitment. Figures are projections from sponsor inputs. Tax and CAD
          values when shown are assessor figures, not market list prices. Verify
          market comps, insurance, title, surveys, and as-complete value
          independently before capital decisions.
        </p>
        <p className="mt-2">
          {BRAND_NAME} · Confidential{shared ? " · Read-only share" : ""}
        </p>
      </footer>
    </article>
  );
}
