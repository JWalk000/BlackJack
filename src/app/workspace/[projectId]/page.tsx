"use client";

import Link from "next/link";
import { use } from "react";
import {
  ProjectWorkspaceLayout,
  WorkspaceReady,
} from "@/components/workspace/AuthGate";
import { useWorkspace } from "@/context/WorkspaceContext";

function Overview({ projectId }: { projectId: string }) {
  const { getProject } = useWorkspace();
  const project = getProject(projectId);
  if (!project) return null;

  const issues = project.documents.filter((d) => d.status === "issue").length;
  const reviews = project.documents.filter((d) => d.status === "review").length;
  const cleared = project.documents.filter((d) => d.status === "clear").length;
  const avgProgress = Math.round(
    project.schedule.reduce((a, t) => a + t.progress, 0) /
      Math.max(project.schedule.length, 1),
  );

  const fromDeal = Boolean(project.sourceLeadId);

  const planSteps = [
    {
      n: "01",
      title: "Site screening",
      copy: "Confirm zoning, setbacks, and deal-breaker diligence flags for this parcel.",
      href: `/workspace/${project.id}/tools#screening`,
      altHref: "/plan/screening",
    },
    {
      n: "02",
      title: "Property & cost",
      copy: "Review the prefilled property record and underwrite flip or rent / BRRRR.",
      href: `/workspace/${project.id}/analysis`,
    },
    {
      n: "03",
      title: "Program / design",
      copy: "Generative unit mix and floor plates for multifamily; cost tools for SF rebuilds.",
      href: `/workspace/${project.id}/tools#design`,
      altHref: "/plan/generative",
    },
    {
      n: "04",
      title: "Documents",
      copy: "Upload PSA, title, environmental, and survey — AI flags risk language.",
      href: `/workspace/${project.id}/documents`,
    },
    {
      n: "05",
      title: "Schedule",
      copy: "Track entitlements through construction milestones.",
      href: `/workspace/${project.id}/progress`,
    },
  ];

  return (
    <div className="mx-auto max-w-5xl px-5 py-10 sm:px-8">
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-sage">
        {fromDeal ? "From Deal Finder" : "Project"}
      </p>
      <h1 className="mt-2 font-display text-4xl text-ink">{project.name}</h1>
      <p className="mt-2 text-sm text-steel">
        {project.address || "No address set"} · {project.region}
        {project.productType ? ` · ${project.productType}` : ""}
      </p>
      {project.planNotes && (
        <p className="mt-4 max-w-2xl border-l-2 border-copper pl-4 text-sm leading-relaxed text-steel">
          {project.planNotes}
        </p>
      )}

      <div className="mt-10">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-sage">
          Next steps · planning process
        </p>
        <ol className="mt-4 divide-y divide-line border border-line">
          {planSteps.map((step) => (
            <li key={step.n}>
              <Link
                href={step.href}
                className="flex flex-wrap items-start gap-4 px-4 py-4 transition hover:bg-limestone sm:px-5"
              >
                <span className="font-mono text-sm text-copper">{step.n}</span>
                <div className="min-w-0 flex-1">
                  <h2 className="font-display text-xl text-ink">{step.title}</h2>
                  <p className="mt-1 text-sm text-steel">{step.copy}</p>
                </div>
                <span className="text-sm text-copper">Continue →</span>
              </Link>
            </li>
          ))}
        </ol>
        {fromDeal && (
          <p className="mt-3 text-xs text-steel">
            Property and cost assumptions were prefilled from the deal scan —
            refine them on step 02.
          </p>
        )}
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        {[
          { label: "Documents", value: String(project.documents.length) },
          { label: "Needs attention", value: String(issues + reviews) },
          { label: "Schedule progress", value: `${avgProgress}%` },
        ].map((stat) => (
          <div key={stat.label} className="border border-line bg-limestone p-5">
            <p className="text-xs uppercase tracking-wider text-sage">
              {stat.label}
            </p>
            <p className="mt-2 font-display text-3xl text-ink">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-10 grid gap-6 md:grid-cols-2">
        <Link
          href={`/workspace/${project.id}/analysis`}
          className="border-t border-ink pt-5 transition hover:border-copper md:col-span-2"
        >
          <h2 className="font-display text-2xl text-ink">Property & cost</h2>
          <p className="mt-2 text-sm text-steel">
            Property record plus cost modeling — regional build cost with flip
            and rent / BRRRR underwriting.
          </p>
          <span className="mt-4 inline-block text-sm text-copper">Open →</span>
        </Link>
        <Link
          href={`/workspace/${project.id}/documents`}
          className="border-t border-ink pt-5 transition hover:border-copper"
        >
          <h2 className="font-display text-2xl text-ink">Document review</h2>
          <p className="mt-2 text-sm text-steel">
            {cleared} cleared · {reviews} in review · {issues} with issues
          </p>
          <span className="mt-4 inline-block text-sm text-copper">Open →</span>
        </Link>
        <Link
          href={`/workspace/${project.id}/progress`}
          className="border-t border-ink pt-5 transition hover:border-copper"
        >
          <h2 className="font-display text-2xl text-ink">Progress & schedule</h2>
          <p className="mt-2 text-sm text-steel">
            {project.schedule.length} milestones tracked
          </p>
          <span className="mt-4 inline-block text-sm text-copper">Open →</span>
        </Link>
      </div>
    </div>
  );
}

export default function ProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);
  return (
    <WorkspaceReady>
      <ProjectWorkspaceLayout projectId={projectId}>
        <Overview projectId={projectId} />
      </ProjectWorkspaceLayout>
    </WorkspaceReady>
  );
}
