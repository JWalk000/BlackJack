"use client";

import { DealFinder } from "@/components/DealFinder";
import { WorkspaceReady } from "@/components/workspace/AuthGate";
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";

function DealsHome() {
  return (
    <WorkspaceShell>
      <div className="mx-auto max-w-5xl px-5 py-10 sm:px-8">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-sage">
          Deal Finder
        </p>
        <h1 className="mt-2 font-display text-4xl text-ink">
          Identify potential deals
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-steel">
          Find Houston off-market land and rebuilds for single-family,
          duplex–fourplex, townhome, and multifamily product — then check margin
          vs regional build cost.
        </p>
        <div className="mt-10">
          <DealFinder />
        </div>
      </div>
    </WorkspaceShell>
  );
}

export default function WorkspaceDealsPage() {
  return (
    <WorkspaceReady>
      <DealsHome />
    </WorkspaceReady>
  );
}
