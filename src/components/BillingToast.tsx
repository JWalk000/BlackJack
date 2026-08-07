"use client";

import Link from "next/link";
import { useEffect } from "react";

export type BillingToastState = {
  message: string;
  open: boolean;
};

export function BillingToast({
  state,
  onClose,
}: {
  state: BillingToastState;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!state.open) return;
    const t = window.setTimeout(onClose, 8000);
    return () => window.clearTimeout(t);
  }, [state.open, state.message, onClose]);

  if (!state.open) return null;

  return (
    <div
      role="status"
      className="fixed bottom-6 left-1/2 z-[80] w-[min(28rem,calc(100%-2rem))] -translate-x-1/2 border border-line bg-ink px-4 py-3 text-paper shadow-lg"
    >
      <p className="text-sm leading-relaxed text-sand">{state.message}</p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Link
          href="/pricing"
          className="text-sm font-semibold text-signal hover:text-brass"
          onClick={onClose}
        >
          View pricing →
        </Link>
        <button
          type="button"
          onClick={onClose}
          className="text-sm text-sand/70 hover:text-paper"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
