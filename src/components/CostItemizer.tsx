"use client";

import {
  COST_CATEGORIES,
  COST_CATEGORY_LABELS,
  buildTemplateItems,
  emptyCostLine,
  scaleCostItems,
  sumCostItems,
  type ScopeKind,
} from "@/lib/cost-items";
import type { CostItemCategory, CostLineItem } from "@/lib/types";

function money(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

const inputClass =
  "w-full border border-line bg-paper px-2.5 py-1.5 text-sm outline-none ring-copper focus:ring-1";

type CostItemizerProps = {
  scope: ScopeKind;
  items: CostLineItem[];
  /** Fallback total when seeding from a flat rehab budget */
  flatBudget: number;
  /** Regional construction suggestion */
  modelBudget: number;
  onChange: (items: CostLineItem[]) => void;
};

export function CostItemizer({
  scope,
  items,
  flatBudget,
  modelBudget,
  onChange,
}: CostItemizerProps) {
  const total = sumCostItems(items);

  function updateItem(id: string, patch: Partial<CostLineItem>) {
    onChange(items.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }

  function removeItem(id: string) {
    onChange(items.filter((i) => i.id !== id));
  }

  function addLine() {
    onChange([...items, emptyCostLine("other")]);
  }

  function seedFromTemplate(target: number) {
    onChange(buildTemplateItems(scope, target));
  }

  function scaleTo(target: number) {
    if (items.length === 0) {
      seedFromTemplate(target);
      return;
    }
    onChange(scaleCostItems(items, target));
  }

  const byCategory = COST_CATEGORIES.map((cat) => ({
    cat,
    lines: items.filter((i) => i.category === cat),
  })).filter((g) => g.lines.length > 0);

  // Lines with categories not in filter shouldn't vanish - they all map
  const allShown = new Set(byCategory.flatMap((g) => g.lines.map((l) => l.id)));
  const orphan = items.filter((i) => !allShown.has(i.id));

  return (
    <div className="border border-line bg-paper p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-sage">
            03 · Itemized scope
          </p>
          <h2 className="mt-2 font-display text-2xl text-ink">
            {scope === "rehab" ? "Remodel cost detail" : "Build cost detail"}
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-steel">
            Break construction into trades and rooms. Line totals drive the deal
            construction / rehab budget.
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-wider text-sage">
            Itemized total
          </p>
          <p className="mt-1 font-display text-2xl text-ink">{money(total)}</p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() =>
            seedFromTemplate(flatBudget > 0 ? flatBudget : modelBudget)
          }
          className="border border-line px-3 py-1.5 text-xs font-medium text-ink transition hover:border-ink"
        >
          {items.length ? "Reset from template" : "Start with template"} ·{" "}
          {money(flatBudget > 0 ? flatBudget : modelBudget)}
        </button>
        <button
          type="button"
          onClick={() => seedFromTemplate(modelBudget)}
          className="border border-line px-3 py-1.5 text-xs font-medium text-ink transition hover:border-ink"
        >
          Seed from regional model · {money(modelBudget)}
        </button>
        {items.length > 0 && Math.abs(total - modelBudget) > 1 && (
          <button
            type="button"
            onClick={() => scaleTo(modelBudget)}
            className="border border-line px-3 py-1.5 text-xs font-medium text-ink transition hover:border-ink"
          >
            Scale items to model
          </button>
        )}
        {items.length > 0 && (
          <button
            type="button"
            onClick={() => onChange([])}
            className="border border-line px-3 py-1.5 text-xs text-steel transition hover:border-ink hover:text-ink"
          >
            Clear all lines
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <p className="mt-8 border border-dashed border-line bg-limestone px-4 py-8 text-center text-sm text-steel">
          No line items yet. Start with a remodel or full-build template, then
          edit amounts and notes for each trade.
        </p>
      ) : (
        <div className="mt-6 space-y-6">
          {byCategory.map(({ cat, lines }) => {
            const sub = sumCostItems(lines);
            return (
              <div key={cat}>
                <div className="mb-2 flex items-baseline justify-between gap-3 border-b border-line pb-1">
                  <h3 className="text-[11px] font-medium uppercase tracking-[0.14em] text-sage">
                    {COST_CATEGORY_LABELS[cat]}
                  </h3>
                  <span className="font-mono text-xs text-steel">
                    {money(sub)}
                    {total > 0 ? ` · ${((sub / total) * 100).toFixed(0)}%` : ""}
                  </span>
                </div>
                <ul className="space-y-2">
                  {lines.map((line) => (
                    <CostLineRow
                      key={line.id}
                      line={line}
                      onChange={(patch) => updateItem(line.id, patch)}
                      onRemove={() => removeItem(line.id)}
                    />
                  ))}
                </ul>
              </div>
            );
          })}
          {orphan.map((line) => (
            <CostLineRow
              key={line.id}
              line={line}
              onChange={(patch) => updateItem(line.id, patch)}
              onRemove={() => removeItem(line.id)}
            />
          ))}
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
        <button
          type="button"
          onClick={addLine}
          className="text-sm font-medium text-copper hover:text-copper-deep"
        >
          + Add line item
        </button>
        {total > 0 && (
          <p className="text-xs text-sage">
            Sum of lines = deal construction cost
          </p>
        )}
      </div>
    </div>
  );
}

function CostLineRow({
  line,
  onChange,
  onRemove,
}: {
  line: CostLineItem;
  onChange: (patch: Partial<CostLineItem>) => void;
  onRemove: () => void;
}) {
  return (
    <li className="grid gap-2 sm:grid-cols-[7.5rem_1fr_6.5rem_auto] sm:items-center">
      <select
        className={inputClass}
        value={line.category}
        onChange={(e) =>
          onChange({ category: e.target.value as CostItemCategory })
        }
        aria-label="Category"
      >
        {COST_CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {COST_CATEGORY_LABELS[c]}
          </option>
        ))}
      </select>
      <div className="grid gap-1 sm:grid-cols-[1fr_minmax(0,10rem)]">
        <input
          className={inputClass}
          placeholder="Description"
          value={line.name}
          onChange={(e) => onChange({ name: e.target.value })}
          aria-label="Description"
        />
        <input
          className={inputClass}
          placeholder="Notes"
          value={line.notes ?? ""}
          onChange={(e) => onChange({ notes: e.target.value })}
          aria-label="Notes"
        />
      </div>
      <input
        type="number"
        min={0}
        className={`${inputClass} font-mono text-right`}
        value={line.amount}
        onChange={(e) => onChange({ amount: Number(e.target.value) || 0 })}
        aria-label="Amount"
      />
      <button
        type="button"
        onClick={onRemove}
        className="px-2 py-1.5 text-xs text-steel hover:text-ink"
        aria-label="Remove line"
      >
        Remove
      </button>
    </li>
  );
}
