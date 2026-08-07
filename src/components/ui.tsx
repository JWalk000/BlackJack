"use client";

import {
  forwardRef,
  useId,
  useState,
  type KeyboardEventHandler,
  type ReactNode,
} from "react";

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
        {label}
      </span>
      <div className="mt-1.5">{children}</div>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </label>
  );
}

export const inputClass = "studio-input";

/** Hide browser number spinners (finance UI). */
const numberInputClass = `${inputClass} [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`;

/**
 * Inner field inside a flex money shell: no border/padding so digits never sit under `$`.
 */
const bareNumberFieldClass =
  "min-w-0 w-full flex-1 border-0 bg-transparent p-0 text-sm text-ink outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none placeholder:text-muted/55";

/**
 * Format committed number for display when the field is not focused.
 * Money / number fields show blank for 0 or null so users can type freely.
 */
function formatCommitted(
  value: number | null | undefined,
  blankZero: boolean,
): string {
  if (value == null) return "";
  const n = Number(value);
  if (!Number.isFinite(n)) return "";
  if (blankZero && n === 0) return "";
  return String(n);
}

function parseLoose(raw: string): number | null {
  const t = raw.trim().replace(/,/g, "");
  if (t === "" || t === "-" || t === "." || t === "-.") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function clampNumber(n: number, min?: number, max?: number): number {
  let x = n;
  if (min != null && Number.isFinite(min) && x < min) x = min;
  if (max != null && Number.isFinite(max) && x > max) x = max;
  return x;
}

/** Allow numbers, partial decimals, and leading minus while typing. */
function isDraftNumberish(raw: string): boolean {
  const t = raw.replace(/,/g, "");
  return t === "" || /^-?\d*\.?\d*$/.test(t);
}

/**
 * Money field with a draft string while focused so parent `value` updates
 * (and remounts) cannot wipe mid-edit deletes. Empty → 0 on blur;
 * shows blank when committed value is 0.
 *
 * `$` is a flex prefix (not absolute) so it never overlaps digits.
 */
export const MoneyInput = forwardRef<
  HTMLInputElement,
  {
    value: number;
    onChange: (n: number) => void;
    placeholder?: string;
    onKeyDown?: KeyboardEventHandler<HTMLInputElement>;
    id?: string;
    name?: string;
    /** Data attributes for Excel-like cell focus (e.g. CostItemizer). */
    "data-cost-item"?: string;
    "data-cost-field"?: string;
  }
>(function MoneyInput(
  {
    value,
    onChange,
    placeholder = "",
    onKeyDown,
    id,
    name,
    "data-cost-item": dataCostItem,
    "data-cost-field": dataCostField,
  },
  ref,
) {
  // null = not editing → show committed value; string = draft while focused
  const [draft, setDraft] = useState<string | null>(null);
  const autoId = useId();
  const inputId = id ?? autoId;

  const display = draft !== null ? draft : formatCommitted(value, true);

  function commit(raw: string) {
    const n = parseLoose(raw);
    if (n == null) {
      onChange(0);
      return;
    }
    onChange(clampNumber(n, 0));
  }

  return (
    <div className={`${inputClass} flex items-center gap-1.5`}>
      <span
        className="shrink-0 select-none text-sm leading-none text-muted"
        aria-hidden
      >
        $
      </span>
      <input
        ref={ref}
        id={inputId}
        name={name}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        spellCheck={false}
        data-cost-item={dataCostItem}
        data-cost-field={dataCostField}
        className={bareNumberFieldClass}
        value={display}
        placeholder={placeholder}
        onKeyDown={onKeyDown}
        onFocus={(e) => {
          // Seed once when entering; draft stays source of truth until blur.
          setDraft(formatCommitted(value, true));
          const el = e.currentTarget;
          requestAnimationFrame(() => {
            el.select();
          });
        }}
        onChange={(e) => {
          if (draft === null) return; // ignore if somehow not focused
          const raw = e.target.value;
          if (!isDraftNumberish(raw)) return;
          setDraft(raw);
          // Live parent update for underwriting; blank is soft 0 until blur.
          const n = parseLoose(raw);
          onChange(n == null ? 0 : Math.max(0, n));
        }}
        onBlur={() => {
          const raw = draft ?? "";
          setDraft(null);
          commit(raw);
        }}
      />
    </div>
  );
});

/**
 * Generic number field with the same draft-while-focused pattern.
 * Min/max apply only on blur — never re-inject floors while typing.
 * Empty commits as null so parents must not coerce null → default on every
 * keystroke (use underwriting floors or blur handlers instead).
 */
export function NumberInput({
  value,
  onChange,
  min,
  max,
  step = 1,
  placeholder = "",
}: {
  value: number | null;
  onChange: (n: number | null) => void;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const inputId = useId();

  const display = draft !== null ? draft : formatCommitted(value, true);

  function commit(raw: string) {
    const n = parseLoose(raw);
    if (n == null) {
      onChange(null);
      return;
    }
    onChange(clampNumber(n, min, max));
  }

  return (
    <input
      id={inputId}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      spellCheck={false}
      data-step={step}
      className={numberInputClass}
      value={display}
      placeholder={placeholder}
      onFocus={(e) => {
        setDraft(formatCommitted(value, true));
        const el = e.currentTarget;
        requestAnimationFrame(() => {
          el.select();
        });
      }}
      onChange={(e) => {
        if (draft === null) return;
        const raw = e.target.value;
        if (!isDraftNumberish(raw)) return;
        setDraft(raw);
        // Live parse without min/max so parents never re-inject floors mid-edit.
        onChange(parseLoose(raw));
      }}
      onBlur={() => {
        const raw = draft ?? "";
        setDraft(null);
        commit(raw);
      }}
    />
  );
}

export function Metric({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "profit" | "loss" | "accent";
}) {
  const toneClass =
    tone === "profit"
      ? "border-profit/30 bg-profit/10 text-profit"
      : tone === "loss"
        ? "border-loss/30 bg-loss/10 text-loss"
        : tone === "accent"
          ? "border-signal/40 bg-signal/10 text-ink"
          : "border-line bg-stone text-ink";

  return (
    <div className={`border px-4 py-3.5 ${toneClass}`}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] opacity-75">
        {label}
      </p>
      <p className="mt-1.5 font-display text-2xl tracking-tight">{value}</p>
    </div>
  );
}

export function SectionTitle({
  eyebrow,
  title,
}: {
  eyebrow?: string;
  title: string;
}) {
  return (
    <div>
      {eyebrow ? <p className="page-label">{eyebrow}</p> : null}
      <h2
        className={`font-display text-2xl tracking-tight text-ink sm:text-3xl ${
          eyebrow ? "mt-2" : ""
        }`}
      >
        {title}
      </h2>
    </div>
  );
}
