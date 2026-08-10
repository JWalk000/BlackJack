"use client";

import type { KeyboardEvent } from "react";
import type { CostItem } from "@/lib/types";
import { COST_CATEGORY_ORDER } from "@/lib/types";
import { money, uid } from "@/lib/underwriting";
import { Field, MoneyInput, inputClass } from "./ui";

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

type CostNavField = "label" | "category" | "amount";

function focusCostField(itemId: string, field: CostNavField) {
  const el = document.querySelector<HTMLInputElement>(
    `[data-cost-item="${itemId}"][data-cost-field="${field}"]`,
  );
  el?.focus();
}

export function CostItemizer({
  items,
  onChange,
  onResetTemplate,
  propertyClass,
  buildMode,
  costBudget = 0,
  onCostBudgetChange,
}: {
  items: CostItem[];
  onChange: (items: CostItem[]) => void;
  onResetTemplate?: () => void;
  propertyClass?: string;
  buildMode?: string;
  /** Deal target for itemized construction costs. 0 = not set. */
  costBudget?: number;
  onCostBudgetChange?: (budget: number) => void;
}) {
  const total = items.reduce((s, i) => s + (Number(i.amount) || 0), 0);
  const budget = Math.max(0, Number(costBudget) || 0);
  const budgetSet = budget > 0;
  const remaining = budgetSet ? budget - total : null;
  const overBudget = budgetSet && total > budget;
  const usedPct = budgetSet
    ? Math.min(999, Math.round((total / budget) * 100))
    : 0;
  const barPct = budgetSet ? Math.min(100, (total / budget) * 100) : 0;

  function update(id: string, patch: Partial<CostItem>) {
    onChange(items.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }

  function remove(id: string) {
    onChange(items.filter((i) => i.id !== id));
  }

  function add() {
    onChange([
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
  // Visual row order (categories top-to-bottom, rows within each block).
  const orderedIds = categories.flatMap((cat) =>
    byCategory[cat].map((i) => i.id),
  );

  function handleEnterNav(
    e: KeyboardEvent<HTMLInputElement>,
    itemId: string,
    field: CostNavField,
  ) {
    if (e.key !== "Enter") return;
    // Excel-style: never submit the parent form on Enter in a cost cell.
    e.preventDefault();

    if (field === "label") {
      focusCostField(itemId, "category");
      return;
    }
    if (field === "category") {
      focusCostField(itemId, "amount");
      return;
    }

    // Amount → next row Amount (same column); stay put on last row.
    const idx = orderedIds.indexOf(itemId);
    if (idx < 0 || idx >= orderedIds.length - 1) return;
    focusCostField(orderedIds[idx + 1], "amount");
  }

  const softTotal = items
    .filter((i) =>
      /soft/i.test(i.category || ""),
    )
    .reduce((s, i) => s + (Number(i.amount) || 0), 0);
  const hardTotal = items
    .filter(
      (i) =>
        /hard|mep|csi/i.test(i.category || "") &&
        !/soft/i.test(i.category || ""),
    )
    .reduce((s, i) => s + (Number(i.amount) || 0), 0);

  const scopeLabel =
    propertyClass === "commercial"
      ? buildMode === "rehab"
        ? "Commercial rehab · CSI soft + division hard costs"
        : "Commercial ground-up · CSI soft + division hard costs"
      : buildMode === "new_build"
        ? "Residential ground-up · NAHB-style soft + hard"
        : "Residential rehab · soft + hard work packages";

  return (
    <div className="space-y-8">
      {/* Sticky budget tracker */}
      <div
        className={`sticky top-0 z-20 border px-4 py-4 sm:px-5 ${
          overBudget
            ? "border-loss/40 bg-[color-mix(in_srgb,var(--loss)_8%,var(--paper))]"
            : "border-line bg-paper/95 backdrop-blur-sm"
        }`}
        role="region"
        aria-label="Deal cost budget tracker"
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="grid min-w-0 flex-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field
              label="Deal budget"
              hint="Your max for this itemized scope"
            >
              <MoneyInput
                value={budget}
                onChange={(v) => onCostBudgetChange?.(Math.max(0, v))}
              />
            </Field>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
                Spent
              </p>
              <p
                className={`mt-1.5 font-display text-2xl tracking-tight sm:text-3xl ${
                  overBudget ? "text-loss" : "text-ink"
                }`}
              >
                {money(total)}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
                {budgetSet
                  ? overBudget
                    ? "Over by"
                    : "Remaining"
                  : "Set a budget"}
              </p>
              <p
                className={`mt-1.5 font-display text-2xl tracking-tight sm:text-3xl ${
                  !budgetSet
                    ? "text-muted"
                    : overBudget
                      ? "text-loss"
                      : remaining != null && remaining <= budget * 0.1
                        ? "text-signal"
                        : "text-profit"
                }`}
              >
                {budgetSet && remaining != null
                  ? money(Math.abs(remaining))
                  : "—"}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
                Used
              </p>
              <p
                className={`mt-1.5 font-display text-2xl tracking-tight sm:text-3xl ${
                  overBudget ? "text-loss" : "text-ink"
                }`}
              >
                {budgetSet ? `${usedPct}%` : "—"}
              </p>
            </div>
          </div>
        </div>

        {budgetSet ? (
          <div className="mt-4">
            <div className="h-2 overflow-hidden bg-stone">
              <div
                className={`h-full transition-[width,background-color] ${
                  overBudget ? "bg-loss" : "bg-signal"
                }`}
                style={{ width: `${barPct}%` }}
              />
            </div>
          </div>
        ) : null}

        {overBudget ? (
          <p
            className="mt-3 text-sm font-medium text-loss"
            role="alert"
            aria-live="polite"
          >
            Over budget by {money(total - budget)}. Trim line items or raise
            the deal budget so the number still works.
          </p>
        ) : budgetSet && total > 0 && remaining != null && remaining <= budget * 0.1 ? (
          <p className="mt-3 text-sm text-muted" role="status">
            Within 10% of budget — {money(remaining)} left before you max out.
          </p>
        ) : !budgetSet ? (
          <p className="mt-3 text-sm text-muted">
            Enter a deal budget above. As you fill sections, spend and remaining
            update so you know if the itemization stays on plan.
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-6">
        <div>
          <p className="page-label">Itemized budget</p>
          <p className="mt-2 font-display text-3xl tracking-tight text-ink sm:text-4xl">
            {money(total)}
          </p>
          <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted">
            {scopeLabel}. Enter your market dollars — no baked-in survey
            prices. Totals feed final numbers.
          </p>
          {(softTotal > 0 || hardTotal > 0) && (
            <p className="mt-3 text-xs text-muted">
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
            Add line item
          </button>
        </div>
      </div>

      {categories.map((category) => {
        const rows = byCategory[category];
        const sub = rows.reduce((s, i) => s + (Number(i.amount) || 0), 0);
        return (
          <section key={category}>
            <h3 className="mb-3 flex flex-wrap items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-signal">
              <span className="h-px min-w-8 flex-1 bg-line" />
              <span>{category}</span>
              <span className="normal-case tracking-normal text-muted">
                {money(sub)}
              </span>
              <span className="h-px min-w-8 flex-1 bg-line" />
            </h3>
            <div className="space-y-3">
              {rows.map((item) => (
                <div
                  key={item.id}
                  className="panel grid gap-3 p-4 sm:grid-cols-[1.2fr_1fr_8rem_auto]"
                >
                  <Field label="Label">
                    <input
                      className={inputClass}
                      data-cost-item={item.id}
                      data-cost-field="label"
                      value={item.label}
                      onChange={(e) =>
                        update(item.id, { label: e.target.value })
                      }
                      onKeyDown={(e) => handleEnterNav(e, item.id, "label")}
                      onFocus={(e) => e.currentTarget.select()}
                    />
                    {item.notes ? (
                      <p className="mt-1 text-xs text-muted">{item.notes}</p>
                    ) : null}
                  </Field>
                  <Field label="Category">
                    <input
                      className={inputClass}
                      data-cost-item={item.id}
                      data-cost-field="category"
                      value={item.category}
                      onChange={(e) =>
                        update(item.id, { category: e.target.value })
                      }
                      onKeyDown={(e) =>
                        handleEnterNav(e, item.id, "category")
                      }
                      onFocus={(e) => e.currentTarget.select()}
                    />
                  </Field>
                  <Field label="Amount">
                    <MoneyInput
                      id={`cost-amount-${item.id}`}
                      name={`cost-amount-${item.id}`}
                      data-cost-item={item.id}
                      data-cost-field="amount"
                      value={item.amount}
                      onChange={(amount) => update(item.id, { amount })}
                      onKeyDown={(e) =>
                        handleEnterNav(e, item.id, "amount")
                      }
                    />
                  </Field>
                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={() => remove(item.id)}
                      className="btn-ghost w-full sm:w-auto"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        );
      })}

      {items.length === 0 ? (
        <p className="border border-dashed border-line bg-stone/60 px-4 py-12 text-center text-sm text-muted">
          No cost lines. Use Reset cost template or add custom items.
        </p>
      ) : null}
    </div>
  );
}

function costsHaveAmounts(items: CostItem[]): boolean {
  return items.some((i) => Number(i.amount) > 0);
}
