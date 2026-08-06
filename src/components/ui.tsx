"use client";

import type { ReactNode } from "react";

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

export function MoneyInput({
  value,
  onChange,
  placeholder = "0",
}: {
  value: number;
  onChange: (n: number) => void;
  placeholder?: string;
}) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">
        $
      </span>
      <input
        type="number"
        min={0}
        step={100}
        className={`${inputClass} pl-7`}
        value={Number.isFinite(value) ? value : 0}
        placeholder={placeholder}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
      />
    </div>
  );
}

export function NumberInput({
  value,
  onChange,
  min,
  max,
  step = 1,
}: {
  value: number | null;
  onChange: (n: number | null) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <input
      type="number"
      min={min}
      max={max}
      step={step}
      className={inputClass}
      value={value ?? ""}
      onChange={(e) => {
        const v = e.target.value;
        onChange(v === "" ? null : Number(v));
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
