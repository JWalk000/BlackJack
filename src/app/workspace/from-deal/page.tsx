"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { WorkspaceReady } from "@/components/workspace/AuthGate";
import { useWorkspace } from "@/context/WorkspaceContext";
import {
  clearPendingDeal,
  loadPendingDeal,
  propertyFromDeal,
  regionLabel,
  underwritingFromDeal,
} from "@/lib/deal-project";

/**
 * Completes Deal Finder → project handoff (works without login as a guest).
 */
function FromDealInner() {
  const { ready, createProject, projects } = useWorkspace();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (!ready || started.current) return;
    started.current = true;

    const deal = loadPendingDeal();
    if (!deal) {
      router.replace("/workspace/deals");
      return;
    }

    // Reuse existing project for the same lead if already started
    const existing = projects.find((p) => p.sourceLeadId === deal.lead.id);
    if (existing) {
      clearPendingDeal();
      router.replace(`/workspace/${existing.id}`);
      return;
    }

    const project = createProject({
      name: deal.lead.address || deal.lead.apn,
      address: `${deal.lead.address}, ${deal.lead.city}`,
      region: regionLabel(deal.lead.marketId),
      property: propertyFromDeal(deal),
      underwriting: underwritingFromDeal(deal),
      sourceLeadId: deal.lead.id,
      productType: deal.productType,
      planNotes: deal.thesis,
    });

    clearPendingDeal();

    if (!project) {
      setError("Could not create project. Try again.");
      return;
    }

    router.replace(`/workspace/${project.id}`);
  }, [ready, createProject, projects, router]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center px-5 text-center">
      {error ? (
        <p className="text-sm text-red-700">{error}</p>
      ) : (
        <>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-sage">
            Starting project
          </p>
          <p className="mt-3 text-sm text-steel">
            Moving this deal into planning…
          </p>
        </>
      )}
    </div>
  );
}

export default function FromDealPage() {
  return (
    <WorkspaceReady>
      <FromDealInner />
    </WorkspaceReady>
  );
}
