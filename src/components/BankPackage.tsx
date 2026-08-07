"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getDeal } from "@/lib/deals";
import type { Deal } from "@/lib/types";
import { useBilling } from "@/lib/billing/context";
import { checkCanSharePackage } from "@/lib/billing/entitlements";
import { PackageDocument } from "./PackageDocument";
import { BillingToast, type BillingToastState } from "./BillingToast";

export function BankPackage({ id }: { id: string }) {
  const { isPro } = useBilling();
  const [deal, setDeal] = useState<Deal | null>(null);
  const [missing, setMissing] = useState(false);
  const [shareStatus, setShareStatus] = useState<string | null>(null);
  const [shareBusy, setShareBusy] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [toast, setToast] = useState<BillingToastState>({
    open: false,
    message: "",
  });

  useEffect(() => {
    const found = getDeal(id);
    if (!found) {
      setMissing(true);
      return;
    }
    setDeal(found);
  }, [id]);

  async function createShareLink() {
    if (!deal) return;
    const gate = checkCanSharePackage(isPro);
    if (!gate.ok) {
      setToast({ open: true, message: gate.message });
      setShareStatus(gate.message);
      return;
    }
    setShareBusy(true);
    setShareStatus(null);
    try {
      const res = await fetch("/api/packages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deal }),
      });
      const data = (await res.json()) as {
        url?: string;
        error?: string;
        needsSupabase?: boolean;
        storage?: string;
      };
      if (!res.ok || !data.url) {
        setShareStatus(
          data.error ||
            (data.needsSupabase
              ? "Share links need Supabase. See README for setup."
              : "Could not create share link."),
        );
        return;
      }
      setShareUrl(data.url);
      try {
        await navigator.clipboard.writeText(data.url);
        setShareStatus(
          data.storage === "file"
            ? "Link copied (stored locally — configure Supabase for production)."
            : "Share link copied to clipboard.",
        );
      } catch {
        setShareStatus("Share link ready — copy from the field below.");
      }
    } catch {
      setShareStatus("Network error creating share link.");
    } finally {
      setShareBusy(false);
    }
  }

  if (missing) {
    return (
      <div className="mx-auto max-w-lg px-6 py-20 text-center">
        <p className="font-display text-2xl">Deal not found</p>
        <Link href="/deals" className="mt-4 inline-block text-signal">
          Back to deals
        </Link>
      </div>
    );
  }

  if (!deal) {
    return (
      <div className="px-6 py-20 text-sm text-muted">Loading package…</div>
    );
  }

  return (
    <div className="bank-package min-h-screen bg-[#faf9f7] text-[#111]">
      <div className="print:hidden sticky top-16 z-30 border-b border-[#ddd] bg-[#faf9f7]/95 backdrop-blur">
        <div className="mx-auto flex max-w-[8.5in] flex-col gap-3 px-5 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link
              href={`/deals/${deal.id}`}
              className="inline-flex min-h-11 items-center text-sm text-[#555] hover:text-[#111]"
            >
              ← Back to deal
            </Link>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
              <button
                type="button"
                onClick={() => window.print()}
                className="min-h-11 bg-[#12352c] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#1f5c48]"
              >
                Download PDF for bank
              </button>
              <button
                type="button"
                disabled={shareBusy}
                onClick={createShareLink}
                title={
                  isPro
                    ? "Create a read-only share link"
                    : "Pro feature — upgrade to share online"
                }
                className="min-h-11 border border-[#12352c] bg-white px-5 py-2.5 text-sm font-semibold text-[#12352c] hover:bg-[#efe6d4] disabled:opacity-60"
              >
                {shareBusy
                  ? "Creating link…"
                  : isPro
                    ? "Copy share link"
                    : "Share link (Pro)"}
              </button>
            </div>
          </div>
          <p className="text-[11px] text-[#666]">
            Print → Save as PDF in your browser.
            {isPro
              ? " Share link is a read-only snapshot for lenders (no login required)."
              : " Online share links require Pro — PDF print works on Free."}
          </p>
          {shareStatus ? (
            <p className="text-sm text-[#12352c]" role="status">
              {shareStatus}{" "}
              {!isPro ? (
                <Link href="/pricing" className="font-semibold underline">
                  View pricing
                </Link>
              ) : null}
            </p>
          ) : null}
          {shareUrl ? (
            <input
              readOnly
              value={shareUrl}
              className="w-full border border-[#ccc] bg-white px-3 py-2 text-xs text-[#333]"
              onFocus={(e) => e.target.select()}
            />
          ) : null}
        </div>
      </div>

      <PackageDocument deal={deal} />
      <BillingToast
        state={toast}
        onClose={() => setToast((t) => ({ ...t, open: false }))}
      />
    </div>
  );
}
