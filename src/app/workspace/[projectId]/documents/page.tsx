"use client";

import { use } from "react";
import {
  ProjectWorkspaceLayout,
  WorkspaceReady,
} from "@/components/workspace/AuthGate";
import { DocumentUploader } from "@/components/workspace/DocumentUploader";

function DocumentsView({ projectId }: { projectId: string }) {
  return (
    <div className="mx-auto max-w-5xl px-5 py-10 sm:px-8">
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-sage">
        Execution · Documents
      </p>
      <h1 className="mt-2 font-display text-4xl text-ink">Document review</h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-steel">
        Upload purchase agreements, titles, and environmental reports. Estate
        runs a simulated AI pass for exceptions, contingencies, and risk
        language — stored on this project only.
      </p>
      <div className="mt-10">
        <DocumentUploader projectId={projectId} />
      </div>
    </div>
  );
}

export default function ProjectDocumentsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);
  return (
    <WorkspaceReady>
      <ProjectWorkspaceLayout projectId={projectId}>
        <DocumentsView projectId={projectId} />
      </ProjectWorkspaceLayout>
    </WorkspaceReady>
  );
}
