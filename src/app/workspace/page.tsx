"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { WorkspaceReady } from "@/components/workspace/AuthGate";
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";
import { useWorkspace } from "@/context/WorkspaceContext";
import type { ProjectStatus } from "@/lib/types";

const REGIONS = [
  "Austin MSA",
  "Denver MSA",
  "Nashville MSA",
  "Raleigh MSA",
  "Other",
];

const STATUS_LABEL: Record<ProjectStatus, string> = {
  planning: "Planning",
  diligence: "Diligence",
  execution: "Execution",
};

function WorkspaceHome() {
  const { projects, createProject, deleteProject } = useWorkspace();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [region, setRegion] = useState(REGIONS[0]);

  function onCreate(e: FormEvent) {
    e.preventDefault();
    const project = createProject({
      name: name.trim(),
      address: address.trim(),
      region,
    });
    if (!project) return;
    setOpen(false);
    setName("");
    setAddress("");
    router.push(`/workspace/${project.id}`);
  }

  return (
    <WorkspaceShell>
      <div className="mx-auto max-w-5xl px-5 py-10 sm:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-sage">
              Workspace
            </p>
            <h1 className="mt-2 font-display text-4xl text-ink">Projects</h1>
            <p className="mt-2 max-w-xl text-sm text-steel">
              Each project holds documents, schedule, and planning tools. Use the
              site freely — sign in later only if you want an account on this
              device.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="bg-ink px-5 py-2.5 text-sm font-medium text-paper transition hover:bg-forest"
          >
            New project
          </button>
        </div>

        {open && (
          <form
            onSubmit={onCreate}
            className="mt-8 border border-line bg-limestone p-6"
          >
            <h2 className="font-display text-2xl text-ink">Create project</h2>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <label className="block sm:col-span-2">
                <span className="text-xs font-medium uppercase tracking-[0.16em] text-sage">
                  Project name
                </span>
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Oakridge Multifamily"
                  className="mt-2 w-full border border-line bg-paper px-4 py-3 text-sm outline-none"
                />
              </label>
              <label className="block sm:col-span-2">
                <span className="text-xs font-medium uppercase tracking-[0.16em] text-sage">
                  Site address
                </span>
                <input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="1847 Oakridge Blvd, Austin, TX"
                  className="mt-2 w-full border border-line bg-paper px-4 py-3 text-sm outline-none"
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium uppercase tracking-[0.16em] text-sage">
                  Region
                </span>
                <select
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  className="mt-2 w-full border border-line bg-paper px-4 py-3 text-sm outline-none"
                >
                  {REGIONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="mt-6 flex gap-3">
              <button
                type="submit"
                className="bg-ink px-5 py-2.5 text-sm font-medium text-paper hover:bg-forest"
              >
                Create
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="border border-line px-5 py-2.5 text-sm text-steel"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        <ul className="mt-10 divide-y divide-line border-t border-line">
          {projects.length === 0 && (
            <li className="py-12 text-center text-sm text-steel">
              No projects yet. Create one to start document review and schedule
              tracking.
            </li>
          )}
          {projects.map((project) => (
            <li
              key={project.id}
              className="flex flex-wrap items-center justify-between gap-4 py-5"
            >
              <div>
                <Link
                  href={`/workspace/${project.id}`}
                  className="font-display text-2xl text-ink hover:text-forest"
                >
                  {project.name}
                </Link>
                <p className="mt-1 text-sm text-steel">
                  {project.address || "No address"} · {project.region}
                </p>
                <p className="mt-2 text-xs text-sage">
                  {STATUS_LABEL[project.status]} · {project.documents.length}{" "}
                  docs · Updated{" "}
                  {new Date(project.updatedAt).toLocaleDateString()}
                </p>
              </div>
              <div className="flex gap-2">
                <Link
                  href={`/workspace/${project.id}`}
                  className="bg-ink px-4 py-2 text-sm text-paper hover:bg-forest"
                >
                  Open
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm(`Delete ${project.name}?`)) {
                      deleteProject(project.id);
                    }
                  }}
                  className="border border-line px-4 py-2 text-sm text-steel hover:border-ink"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </WorkspaceShell>
  );
}

export default function WorkspacePage() {
  return (
    <WorkspaceReady>
      <WorkspaceHome />
    </WorkspaceReady>
  );
}
