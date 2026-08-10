"use client";

import { Fragment, type KeyboardEvent } from "react";
import type { CostItem, Deal } from "@/lib/types";
import { COST_CATEGORY_ORDER } from "@/lib/types";
import { summarizeBudget } from "@/lib/budget";
import { money, uid } from "@/lib/underwriting";
import { DealBudgetStrip } from "./DealBudgetStrip";
import { MoneyInput } from "./ui";

function sortCategories(cats: string[]): string[] {
  const order = COST_CATEGORY_ORDER as readonly string[];
  return [...cats].sort((a, b) => {
    const ia = order.indexOf(a);
    const ib = order.indexOf(b);
    const sa = ia === -1 ? 999 : ia;
    const sb = ib === -1 ? 999 : ib;
    if (sa !== sb) return sa - sb;
    return a.localeCompare(b);
  });
}

type CostNavField = "label" | "category" | "notes" | "amount";

const FIELDS: CostNavField[] = ["label", "category", "notes", "amount"];

const sheetCell =
  "border-b border-r border-line bg-paper p-0 align-middle transition focus-within:bg-canopy/10 focus-within:ring-1 focus-within:ring-inset focus-within:ring-signal";
const sheetInput =
  "min-h-9 w-full border-0 bg-transparent px-2 py-1.5 text-sm text-ink outline-none placeholder:text-muted/50";
const sheetHeader =
  "sticky top-[var(--cost-sheet-sticky,0px)] z-10 border-b border-r border-line bg-stone px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-muted";

function focusCostField(itemId: string, field: CostNavField) {
  const el = document.querySelector<HTMLInputElement>(
    `[data-cost-item="${itemId}"][data-cost-field="${field}"]`,
  );
  el?.focus();
}

export function CostItemizer({
  deal,
  onChange,
  onResetTemplate,
}: {
  deal: Deal;
  onChange: (deal: Deal) => void;
  onResetTemplate?: () => void;
}) {
  const items = deal.costItems;
  const total = items.reduce((s, i) => s + (Number(i.amount) || 0), 0);
  const budget = summarizeBudget(deal);
  const overBudget = budget.status === "over";

  function setItems(next: CostItem[]) {
    onChange({ ...deal, costItems: next });
  }

  function update(id: string, patch: Partial<CostItem>) {
    setItems(items.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }

  function remove(id: string) {
    setItems(items.filter((i) => i.id !== id));
  }

  function add() {
    setItems([
      ...items,
      {
        id: uid("cost"),
        category: "Custom",
        label: "New line item",
        amount: 0,
        notes: "",
      },
    ]);
  }

  const byCategory = items.reduce<Record<string, CostItem[]>>((acc, item) => {
    const key = item.category || "Other";
    (acc[key] ??= []).push(item);
    return acc;
  }, {});

  const categories = sortCategories(Object.keys(byCategory));
  const orderedIds = categories.flatMap((cat) =>
    byCategory[cat].map((i) => i.id),
  );

  function handleSheetKey(
    e: KeyboardEvent<HTMLInputElement>,
    itemId: string,
    field: CostNavField,
  ) {
    const idx = orderedIds.indexOf(itemId);
    const fieldIdx = FIELDS.indexOf(field);

    if (e.key === "Enter" || (e.key === "ArrowDown" && !e.altKey)) {
      e.preventDefault();
      if (idx < 0 || idx >= orderedIds.length - 1) return;
      focusCostField(orderedIds[idx + 1], field);
      return;
    }

    if (e.key === "ArrowUp" && !e.altKey) {
      e.preventDefault();
      if (idx <= 0) return;
      focusCostField(orderedIds[idx - 1], field);
      return;
    }

    if (e.key === "ArrowRight" && e.ctrlKey) {
      e.preventDefault();
      if (fieldIdx < 0 || fieldIdx >= FIELDS.length - 1) return;
      focusCostField(itemId, FIELDS[fieldIdx + 1]);
      return;
    }
    if (e.key === "ArrowLeft" && e.ctrlKey) {
      e.preventDefault();
      if (fieldIdx <= 0) return;
      focusCostField(itemId, FIELDS[fieldIdx - 1]);
    }
  }

  const softTotal = items
    .filter((i) => /soft/i.test(i.category || ""))
    .reduce((s, i) => s + (Number(i.amount) || 0), 0);
  const hardTotal = items
    .filter(
      (i) =>
        /hard|mep|csi/i.test(i.category || "") &&
        !/soft/i.test(i.category || ""),
    )
    .reduce((s, i) => s + (Number(i.amount) || 0), 0);

  const scopeLabel =
    deal.propertyClass === "commercial"
      ? deal.buildMode === "rehab"
        ? "Commercial rehab · CSI soft + division hard costs"
        : "Commercial ground-up · CSI soft + division hard costs"
      : deal.buildMode === "new_build"
        ? "Residential ground-up · NAHB-style soft + hard"
        : "Residential rehab · soft + hard work packages";

  let rowNumber = 0;

  return (
    <div className="space-y-6">
      <DealBudgetStrip deal={deal} onChange={onChange} mode="edit" />

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="page-label">Itemized budget</p>
          <p className="mt-1 max-w-xl text-sm text-muted">
            {scopeLabel}. Sheet-style entry — Tab / arrows, Enter moves down.
            Totals feed Final numbers and the Project snapshot.
          </p>
          {(softTotal > 0 || hardTotal > 0) && (
            <p className="mt-2 text-xs text-muted">
              Soft {money(softTotal)}
              {" · "}
              Hard {money(hardTotal)}
              {total - softTotal - hardTotal > 0
                ? ` · Other ${money(total - softTotal - hardTotal)}`
                : null}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {onResetTemplate ? (
            <button
              type="button"
              onClick={() => {
                if (
                  costsHaveAmounts(items) &&
                  !window.confirm(
                    "Replace itemization with the template for this deal type? Entered amounts will be cleared.",
                  )
                ) {
                  return;
                }
                onResetTemplate();
              }}
              className="btn-ghost w-full sm:w-auto"
            >
              Reset cost template
            </button>
          ) : null}
          <button
            type="button"
            onClick={add}
            className="btn-signal w-full sm:w-auto"
          >
            Add row
          </button>
        </div>
      </div>

      {items.length === 0 ? (
        <p className="border border-dashed border-line bg-stone/60 px-4 py-12 text-center text-sm text-muted">
          No cost lines. Use Reset cost template or add a row.
        </p>
      ) : (
        <div className="overflow-x-auto border border-line shadow-[inset_0_0_0_1px_var(--line)]">
          <table className="w-full min-w-[44rem] border-collapse text-sm">
            <thead>
              <tr>
                <th
                  className={`${sheetHeader} w-10 border-l border-line text-center`}
                  scope="col"
                >
                  #
                </th>
                <th className={`${sheetHeader} min-w-[12rem]`} scope="col">
                  A · Item
                </th>
                <th className={`${sheetHeader} min-w-[8rem]`} scope="col">
                  B · Category
                </th>
                <th className={`${sheetHeader} min-w-[8rem]`} scope="col">
                  C · Notes
                </th>
                <th
                  className={`${sheetHeader} w-[7.5rem] text-right`}
                  scope="col"
                >
                  D · Amount
                </th>
                <th
                  className={`${sheetHeader} w-10 border-r-0 text-center`}
                  scope="col"
                >
                  <span className="sr-only">Remove</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {categories.map((category) => {
                const rows = byCategory[category];
                const sub = rows.reduce(
                  (s, i) => s + (Number(i.amount) || 0),
                  0,
                );
                return (
                  <Fragment key={category}>
                    <tr className="bg-stone/80">
                      <td
                        colSpan={6}
                        className="border-b border-line border-l border-r px-3 py-2"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-signal">
                            {category}
                          </span>
                          <span className="font-mono text-xs tabular-nums text-muted">
                            Subtotal {money(sub)}
                          </span>
                        </div>
                      </td>
                    </tr>
                    {rows.map((item) => {
                      rowNumber += 1;
                      const n = rowNumber;
                      return (
                        <tr
                          key={item.id}
                          className="group even:bg-[color-mix(in_srgb,var(--stone)_35%,var(--paper))]"
                        >
                          <td
                            className={`${sheetCell} border-l w-10 text-center font-mono text-xs text-muted`}
                          >
                            {n}
                          </td>
                          <td className={sheetCell}>
                            <input
                              className={sheetInput}
                              data-cost-item={item.id}
                              data-cost-field="label"
                              value={item.label}
                              onChange={(e) =>
                                update(item.id, { label: e.target.value })
                              }
                              onKeyDown={(e) =>
                                handleSheetKey(e, item.id, "label")
                              }
                              onFocus={(e) => e.currentTarget.select()}
                              aria-label={`Row ${n} item`}
                            />
                          </td>
                          <td className={sheetCell}>
                            <input
                              className={sheetInput}
                              data-cost-item={item.id}
                              data-cost-field="category"
                              value={item.category}
                              onChange={(e) =>
                                update(item.id, { category: e.target.value })
                              }
                              onKeyDown={(e) =>
                                handleSheetKey(e, item.id, "category")
                              }
                              onFocus={(e) => e.currentTarget.select()}
                              aria-label={`Row ${n} category`}
                            />
                          </td>
                          <td className={sheetCell}>
                            <input
                              className={sheetInput}
                              data-cost-item={item.id}
                              data-cost-field="notes"
                              value={item.notes ?? ""}
                              onChange={(e) =>
                                update(item.id, { notes: e.target.value })
                              }
                              onKeyDown={(e) =>
                                handleSheetKey(e, item.id, "notes")
                              }
                              onFocus={(e) => e.currentTarget.select()}
                              placeholder="—"
                              aria-label={`Row ${n} notes`}
                            />
                          </td>
                          <td className={`${sheetCell} text-right`}>
                            <MoneyInput
                              variant="sheet"
                              id={`cost-amount-${item.id}`}
                              name={`cost-amount-${item.id}`}
                              data-cost-item={item.id}
                              data-cost-field="amount"
                              value={item.amount}
                              onChange={(amount) =>
                                update(item.id, { amount })
                              }
                              onKeyDown={(e) =>
                                handleSheetKey(e, item.id, "amount")
                              }
                            />
                          </td>
                          <td
                            className={`${sheetCell} border-r-0 w-10 text-center`}
                          >
                            <button
                              type="button"
                              onClick={() => remove(item.id)}
                              className="inline-flex size-8 items-center justify-center text-muted opacity-60 transition hover:text-loss group-hover:opacity-100"
                              title="Delete row"
                              aria-label={`Delete row ${n}`}
                            >
                              ×
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    <tr className="bg-stone/40">
                      <td
                        colSpan={4}
                        className="border-b border-l border-line px-3 py-1.5 text-right text-[11px] font-semibold uppercase tracking-[0.12em] text-muted"
                      >
                        {category} total
                      </td>
                      <td className="border-b border-line px-2 py-1.5 text-right font-mono text-sm tabular-nums text-ink">
                        {money(sub)}
                      </td>
                      <td className="border-b border-r border-line" />
                    </tr>
                  </Fragment>
                );
              })}
            </tbody>
            <tfoot>
              {budget.contingencyPct > 0 ? (
                <tr className="bg-stone/50">
                  <td
                    colSpan={4}
                    className="border-t border-line px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-[0.12em] text-muted"
                  >
                    Contingency reserve ({budget.contingencyPct}%)
                  </td>
                  <td className="border-t border-line px-2 py-2 text-right font-mono text-sm tabular-nums text-signal">
                    {money(budget.contingencyDollars)}
                  </td>
                  <td className="border-t border-line" />
                </tr>
              ) : null}
              <tr className="bg-ink text-paper">
                <td
                  colSpan={4}
                  className="border-t border-ink px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-[0.14em]"
                >
                  Grand total (spent)
                </td>
                <td
                  className={`border-t border-ink px-2 py-2.5 text-right font-mono text-base font-semibold tabular-nums ${
                    overBudget
                      ? "text-[color-mix(in_srgb,#fff_20%,#f5b5ad)]"
                      : ""
                  }`}
                >
                  {money(total)}
                </td>
                <td className="border-t border-ink" />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <p className="text-xs text-muted">
        Tips: Enter or ↓ moves down a column · Ctrl+← / Ctrl+→ jumps cells ·
        Contingency lives in the budget bar — not a duplicate line item
      </p>
    </div>
  );
}

function costsHaveAmounts(items: CostItem[]): boolean {
  return items.some((i) => Number(i.amount) > 0);
}
