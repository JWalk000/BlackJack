"use client";

import { use } from "react";
import {
  ProjectWorkspaceLayout,
  WorkspaceReady,
} from "@/components/workspace/AuthGate";
import { PropertyAnalysis } from "@/components/workspace/PropertyAnalysis";

export default function ProjectAnalysisPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);
  return (
    <WorkspaceReady>
      <ProjectWorkspaceLayout projectId={projectId}>
        <PropertyAnalysis projectId={projectId} />
      </ProjectWorkspaceLayout>
    </WorkspaceReady>
  );
}
