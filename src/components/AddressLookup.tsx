"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { PropertyInfo } from "@/lib/types";
import {
  suggestionToPropertyPatch,
  type PropertySuggestion,
} from "@/lib/property-lookup";
import { Field, inputClass } from "./ui";

type Props = {
  property: PropertyInfo;
  onApply: (patch: Partial<PropertyInfo>) => void;
  /** When street text is typed without picking a suggestion */
  onStreetChange: (address: string) => void;
};

function sourceLabel(s: PropertySuggestion["source"]) {
  switch (s) {
    case "hcad-live":
      return "Harris CAD";
    case "fbcad-live":
      return "Fort Bend CAD";
    case "free-cad":
      return "Open CAD cache";
    case "census":
      return "US Census address";
    case "rentcast":
      return "RentCast records";
    case "sample":
      return "Sample";
    default:
      return s;
  }
}

export function AddressLookup({
  property,
  onApply,
  onStreetChange,
}: Props) {
  const listId = useId();
  const [query, setQuery] = useState(property.address);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<PropertySuggestion[]>([]);
  const [hint, setHint] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Keep input in sync when parent applies a patch from elsewhere
  useEffect(() => {
    setQuery(property.address);
  }, [property.address]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 3) {
      setSuggestions([]);
      setLoading(false);
      return;
    }
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    const t = window.setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/property/suggest?q=${encodeURIComponent(q)}`,
          { signal: ac.signal },
        );
        const data = (await res.json()) as {
          suggestions?: PropertySuggestion[];
        };
        if (!ac.signal.aborted) {
          setSuggestions(data.suggestions || []);
          setOpen(true);
        }
      } catch {
        if (!ac.signal.aborted) setSuggestions([]);
      } finally {
        if (!ac.signal.aborted) setLoading(false);
      }
    }, 320);
    return () => {
      window.clearTimeout(t);
      ac.abort();
    };
  }, [query]);

  function apply(s: PropertySuggestion) {
    const patch = suggestionToPropertyPatch(s);
    onApply(patch);
    setQuery(s.address);
    setOpen(false);
    setHint(
      s.notes ||
        `Filled from ${sourceLabel(s.source)}. Beds/baths usually need manual entry.`,
    );
  }

  return (
    <div ref={wrapRef} className="relative space-y-2">
      <Field
        label="Street address"
        hint="Search real CAD / public address records"
      >
        <input
          className={inputClass}
          value={query}
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          placeholder="e.g. 4122 Red Bluff Rd"
          onChange={(e) => {
            const v = e.target.value;
            setQuery(v);
            onStreetChange(v);
            setHint(null);
          }}
          onFocus={() => {
            if (suggestions.length) setOpen(true);
          }}
        />
      </Field>
      {loading ? (
        <p className="text-xs text-muted">Searching public records…</p>
      ) : null}
      {open && suggestions.length > 0 ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-30 mt-1 max-h-64 w-full overflow-auto border border-line bg-surface shadow-[0_12px_40px_rgba(12,15,14,0.12)]"
        >
          {suggestions.map((s) => (
            <li key={s.id} role="option">
              <button
                type="button"
                className="flex w-full flex-col items-start gap-0.5 border-b border-line/70 px-3 py-2.5 text-left transition hover:bg-sand/60"
                onClick={() => apply(s)}
              >
                <span className="text-sm font-medium text-ink">{s.label}</span>
                <span className="text-[11px] text-muted">
                  {sourceLabel(s.source)}
                  {s.taxAssessment
                    ? ` · assessed ${s.taxAssessment.toLocaleString("en-US", {
                        style: "currency",
                        currency: "USD",
                        maximumFractionDigits: 0,
                      })}`
                    : ""}
                  {s.buildingSf ? ` · ${s.buildingSf.toLocaleString()} sf` : ""}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {hint ? (
        <p className="text-xs leading-relaxed text-muted">{hint}</p>
      ) : (
        <p className="text-xs text-muted">
          Free first: Houston CAD + US Census. Optional RentCast nationwide when
          an API key is configured. Not MLS. Beds/baths often need manual entry.
        </p>
      )}
    </div>
  );
}
