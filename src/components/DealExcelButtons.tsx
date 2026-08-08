"use client";

import { useRef, useState } from "react";
import type { Deal } from "@/lib/types";
import { downloadDealExcel, importDealFromExcelFile } from "@/lib/deal-excel";

export function DealExcelButtons({
  deal,
  replaceId,
  onImported,
  compact,
}: {
  /** When set, Export uses this deal. */
  deal?: Deal | null;
  /** Replace this deal id on import (workspace edit). */
  replaceId?: string;
  onImported?: (deal: Deal) => void;
  compact?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onFile(file: File | null) {
    if (!file) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await importDealFromExcelFile(file, {
        replaceId: replaceId || undefined,
      });
      if (res.error && !res.deal) {
        setMsg(res.error);
        return;
      }
      if (res.deal) {
        setMsg("Imported from Excel.");
        onImported?.(res.deal);
      }
    } catch {
      setMsg("Import failed.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
      {deal ? (
        <button
          type="button"
          className={
            compact
              ? "font-semibold text-signal hover:text-brass-deep"
              : "btn-ghost w-full sm:w-auto"
          }
          onClick={() => downloadDealExcel(deal)}
        >
          Export Excel
        </button>
      ) : null}
      <button
        type="button"
        disabled={busy}
        className={
          compact
            ? "font-semibold text-muted hover:text-ink disabled:opacity-50"
            : "btn-ghost w-full sm:w-auto disabled:opacity-50"
        }
        onClick={() => inputRef.current?.click()}
      >
        {busy ? "Importing…" : "Import Excel"}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
        className="hidden"
        onChange={(e) => void onFile(e.target.files?.[0] || null)}
      />
      {msg ? (
        <p className="text-xs text-muted" role="status">
          {msg}
        </p>
      ) : null}
    </div>
  );
}
