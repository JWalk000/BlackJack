"use client";

import Link from "next/link";
import { use } from "react";
import {
  ProjectWorkspaceLayout,
  WorkspaceReady,
} from "@/components/workspace/AuthGate";
import { useWorkspace } from "@/context/WorkspaceContext";

function ToolsView({ projectId }: { projectId: string }) {
  const { getProject } = useWorkspace();
  const project = getProject(projectId);
  if (!project) return null;

  const tools = [
    {
      id: "screening",
      href: `/plan/screening?project=${project.id}`,
      title: "Site Screening",
      copy: "Property records, setbacks, and zoning brief — pull this site into diligence.",
      next: "Then underwrite on Property & cost",
    },
    {
      id: "cost",
      href: `/workspace/${project.id}/analysis`,
      title: "Cost & underwriting",
      copy: "Regional build/rehab cost with flip and rent / BRRRR on this project’s property record.",
      next: "Primary step for site basis",
    },
    {
      id: "design",
      href: `/plan/generative?project=${project.id}`,
      title: "Generative Design",
      copy: "Unit mix options and floor plates for multifamily programming.",
      next: "Then lock schedule milestones",
    },
  ];

  return (
    <div className="mx-auto max-w-5xl px-5 py-10 sm:px-8">
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-sage">
        Plan & Design
      </p>
      <h1 className="mt-2 font-display text-4xl text-ink">Planning tools</h1>
      <p className="mt-3 max-w-2xl text-sm text-steel">
        Continue planning for{" "}
        <span className="text-ink">{project.name}</span>
        {project.address ? ` · ${project.address}` : ""}.
      </p>

      <div className="mt-10 grid gap-8 md:grid-cols-3">
        {tools.map((tool, i) => (
          <Link
            key={tool.id}
            id={tool.id}
            href={tool.href}
            className="border-t border-ink pt-5 transition hover:border-copper"
          >
            <span className="font-mono text-xs text-copper">0{i + 1}</span>
            <h2 className="mt-2 font-display text-2xl text-ink">{tool.title}</h2>
            <p className="mt-2 text-sm text-steel">{tool.copy}</p>
            <p className="mt-2 text-xs text-sage">{tool.next}</p>
            <span className="mt-4 inline-block text-sm text-copper">Open →</span>
          </Link>
        ))}
      </div>

      <div className="mt-10 flex flex-wrap gap-4 border-t border-line pt-8 text-sm">
        <Link
          href={`/workspace/${project.id}`}
          className="text-steel hover:text-ink"
        >
          ← Project overview
        </Link>
        <Link
          href={`/workspace/${project.id}/documents`}
          className="font-medium text-copper hover:text-copper-deep"
        >
          Next: documents →
        </Link>
      </div>
    </div>
  );
}

export default function ProjectToolsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);
  return (
    <WorkspaceReady>
      <ProjectWorkspaceLayout projectId={projectId}>
        <ToolsView projectId={projectId} />
      </ProjectWorkspaceLayout>
    </WorkspaceReady>
  );
}
