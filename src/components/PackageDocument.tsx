"use client";

import type { CostItem, Deal } from "@/lib/types";
import { COST_CATEGORY_ORDER } from "@/lib/types";
import { dealTitle } from "@/lib/deals";
import { money, pct, underwrite } from "@/lib/underwriting";

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
  const addressLine = [
    deal.property.address,
    [deal.property.city, deal.property.state, deal.property.zip]
      .filter(Boolean)
      .join(", "),
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

  return (
    <article className="package-sheet mx-auto max-w-[8.5in] px-5 py-8 sm:px-8 sm:py-10 print:max-w-none print:px-0 print:py-0">
      <header className="border-b-2 border-[#111] pb-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="font-display text-3xl tracking-tight text-[#111]">
              Estate
            </p>
            <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#444]">
              Construction / acquisition package
            </p>
          </div>
          <div className="text-right text-sm text-[#444]">
            <p>Prepared {printed}</p>
            <p className="mt-0.5 text-xs">
              {shared ? "Shared for lending review" : "For lending review"}
            </p>
          </div>
        </div>
      </header>

      <section className="mt-6">
        <h1 className="font-display text-3xl leading-tight tracking-tight text-[#111]">
          {title}
        </h1>
        {addressLine ? (
          <p className="mt-2 text-base text-[#333]">{addressLine}</p>
        ) : null}
        <dl className="mt-4 grid gap-2 border border-[#ccc] bg-white p-4 text-sm sm:grid-cols-2">
          <div className="flex justify-between gap-4 sm:block">
            <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#666]">
              Project type
            </dt>
            <dd className="font-medium">{buildLabel}</dd>
          </div>
          <div className="flex justify-between gap-4 sm:block">
            <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#666]">
              Asset class
            </dt>
            <dd className="font-medium">{classLabel}</dd>
          </div>
          <div className="flex justify-between gap-4 sm:block">
            <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#666]">
              Product
            </dt>
            <dd className="font-medium">
              {deal.property.propertyType || "—"}
            </dd>
          </div>
          <div className="flex justify-between gap-4 sm:block">
            <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#666]">
              Exit strategy
            </dt>
            <dd className="font-medium">
              {deal.exitStrategy === "flip" ? "Sell" : "Hold / rent"}
            </dd>
          </div>
          {deal.property.apn ? (
            <div className="flex justify-between gap-4 sm:col-span-2 sm:block">
              <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#666]">
                APN
              </dt>
              <dd className="font-medium">{deal.property.apn}</dd>
            </div>
          ) : null}
          {deal.property.buildingSf ? (
            <div className="flex justify-between gap-4 sm:block">
              <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#666]">
                Building SF
              </dt>
              <dd className="font-medium">
                {deal.property.buildingSf.toLocaleString()}
              </dd>
            </div>
          ) : null}
          {deal.property.units != null ? (
            <div className="flex justify-between gap-4 sm:block">
              <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#666]">
                Units
              </dt>
              <dd className="font-medium">{deal.property.units}</dd>
            </div>
          ) : null}
        </dl>
        {deal.property.description ? (
          <p className="mt-3 text-sm leading-relaxed text-[#444]">
            {deal.property.description}
          </p>
        ) : null}
      </section>

      <section className="mt-8 break-inside-avoid">
        <h2 className="border-b border-[#111] pb-1 font-display text-xl text-[#111]">
          Final numbers
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

      <section className="mt-8 break-inside-avoid">
        <h2 className="border-b border-[#111] pb-1 font-display text-xl text-[#111]">
          Purchase &amp; financing
        </h2>
        <table className="mt-3 w-full border-collapse text-sm">
          <tbody>
            {(
              [
                ["Purchase price", money(deal.assumptions.purchasePrice)],
                [
                  "Closing costs",
                  `${money(deal.assumptions.closingCosts)}${
                    !deal.assumptions.closingCostsManual
                      ? " (4% default)"
                      : ""
                  }`,
                ],
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
                ["After-repair / exit value (ARV)", money(deal.assumptions.arv)],
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
        <h2 className="border-b border-[#111] pb-1 font-display text-xl text-[#111]">
          Itemized cost breakdown
        </h2>
        <p className="mt-2 text-xs text-[#555]">
          Line items as entered by sponsor. Category subtotals and project total
          below.
        </p>

        {groups.map((g) => (
          <div key={g.category} className="mt-5 break-inside-avoid">
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

        <div className="mt-4 flex items-center justify-between border-t-2 border-[#111] pt-3">
          <span className="text-sm font-semibold uppercase tracking-[0.12em]">
            Total itemized budget
          </span>
          <span className="font-display text-2xl">{money(result.buildBudget)}</span>
        </div>
      </section>

      <section className="mt-8 break-inside-avoid">
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

      <footer className="mt-10 border-t border-[#ccc] pt-4 text-[11px] leading-relaxed text-[#666]">
        <p>
          Generated by Estate · not an MLS listing, appraisal, or lending
          commitment. Figures are projections from sponsor inputs. Verify market
          data, insurance, title, and as-complete value independently.
        </p>
        <p className="mt-2">Estate · Confidential{shared ? " · Read-only share" : ""}</p>
      </footer>
    </article>
  );
}
