"use client";

import { useRef, useState } from "react";
import {
  detectDocType,
  readFileExcerpt,
  runSimulatedReview,
} from "@/lib/ai-review";
import { uid } from "@/lib/id";
import type { DocType, ProjectDocument } from "@/lib/types";
import { useWorkspace } from "@/context/WorkspaceContext";

const TYPE_LABELS: Record<DocType, string> = {
  agreement: "Purchase agreement",
  title: "Title",
  environmental: "Environmental",
  survey: "Survey",
  other: "Other",
};

const STATUS_STYLE: Record<ProjectDocument["status"], string> = {
  queued: "bg-limestone text-steel",
  reviewing: "bg-copper/15 text-copper-deep",
  clear: "bg-sage/20 text-canopy",
  review: "bg-copper/15 text-copper-deep",
  issue: "bg-red-100 text-red-800",
};

export function DocumentUploader({ projectId }: { projectId: string }) {
  const { getProject, addDocument, updateDocument, removeDocument } =
    useWorkspace();
  const project = getProject(projectId);
  const inputRef = useRef<HTMLInputElement>(null);
  const [docType, setDocType] = useState<DocType>("agreement");
  const [dragOver, setDragOver] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!project) return null;

  const active =
    project.documents.find((d) => d.id === activeId) ??
    project.documents[0] ??
    null;

  async function processFiles(files: FileList | File[]) {
    setError(null);
    const list = Array.from(files);
    if (!list.length) return;

    for (const file of list) {
      if (file.size > 12 * 1024 * 1024) {
        setError(`${file.name} exceeds the 12MB demo limit.`);
        continue;
      }

      const inferred = detectDocType(file.name);
      const type = inferred !== "other" ? inferred : docType;
      const excerpt = await readFileExcerpt(file);
      const doc: ProjectDocument = {
        id: uid("doc"),
        name: file.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " "),
        type,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type || "application/octet-stream",
        uploadedAt: new Date().toISOString(),
        status: "reviewing",
        findings: [],
        excerpt: excerpt || undefined,
      };

      addDocument(projectId, doc);
      setActiveId(doc.id);

      const result = await runSimulatedReview({
        fileName: file.name,
        type,
        excerpt,
      });

      updateDocument(projectId, doc.id, {
        type: result.type,
        status: result.status,
        findings: result.findings,
      });
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr]">
      <div className="space-y-6">
        <div className="flex flex-wrap items-end gap-3">
          <label className="min-w-[180px] flex-1">
            <span className="text-xs font-medium uppercase tracking-[0.16em] text-sage">
              Document type
            </span>
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value as DocType)}
              className="mt-2 w-full border border-line bg-paper px-3 py-2.5 text-sm outline-none"
            >
              {Object.entries(TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            void processFiles(e.dataTransfer.files);
          }}
          className={`border border-dashed px-6 py-12 text-center transition ${
            dragOver
              ? "border-copper bg-copper/5"
              : "border-line bg-limestone"
          }`}
        >
          <p className="font-display text-xl text-ink">Upload diligence files</p>
          <p className="mt-2 text-sm text-steel">
            PDF, Word, or text. Simulated AI review runs locally — no API
            required. .txt files get keyword scanning.
          </p>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="mt-6 bg-ink px-5 py-2.5 text-sm font-medium text-paper transition hover:bg-forest"
          >
            Choose files
          </button>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".pdf,.doc,.docx,.txt,.md,.csv,application/pdf,text/plain"
            className="hidden"
            onChange={(e) => {
              if (e.target.files) void processFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>

        {error && <p className="text-sm text-red-700">{error}</p>}

        <ul className="divide-y divide-line border border-line bg-paper">
          {project.documents.length === 0 && (
            <li className="px-5 py-8 text-center text-sm text-steel">
              No documents yet. Upload a PSA, title commitment, or Phase I to
              begin review.
            </li>
          )}
          {project.documents.map((doc) => (
            <li key={doc.id}>
              <button
                type="button"
                onClick={() => setActiveId(doc.id)}
                className={`flex w-full items-start justify-between gap-4 px-5 py-4 text-left transition ${
                  active?.id === doc.id ? "bg-limestone" : "hover:bg-limestone/60"
                }`}
              >
                <span>
                  <span className="block text-sm font-medium text-ink">
                    {doc.name}
                  </span>
                  <span className="mt-1 block text-xs text-sage">
                    {TYPE_LABELS[doc.type]} ·{" "}
                    {(doc.fileSize / 1024).toFixed(0)} KB
                  </span>
                </span>
                <span
                  className={`shrink-0 px-2 py-1 text-[10px] font-medium uppercase tracking-wider ${STATUS_STYLE[doc.status]}`}
                >
                  {doc.status === "reviewing" ? "AI reviewing…" : doc.status}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="border border-line bg-limestone p-6">
        {!active ? (
          <p className="text-sm text-steel">
            Select or upload a document to see AI review findings.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="font-display text-2xl text-ink">{active.name}</h2>
                <p className="mt-1 text-sm text-steel">
                  {active.fileName} · {TYPE_LABELS[active.type]}
                </p>
              </div>
              <span
                className={`px-2 py-1 text-[10px] font-medium uppercase tracking-wider ${STATUS_STYLE[active.status]}`}
              >
                {active.status}
              </span>
            </div>

            {active.status === "reviewing" && (
              <p className="mt-8 animate-pulse-soft font-mono text-sm text-sage">
                Reading structure · extracting clauses · scoring risk…
              </p>
            )}

            {active.status !== "reviewing" && (
              <>
                <h3 className="mt-8 text-xs font-medium uppercase tracking-[0.16em] text-sage">
                  AI findings
                </h3>
                <ul className="mt-4 space-y-3">
                  {active.findings.map((f) => (
                    <li
                      key={f.id}
                      className={`border-l-2 pl-4 text-sm leading-relaxed text-steel ${
                        f.severity === "critical"
                          ? "border-red-700"
                          : f.severity === "warn"
                            ? "border-copper"
                            : "border-sage"
                      }`}
                    >
                      <span className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-ink/60">
                        {f.severity}
                      </span>
                      {f.text}
                    </li>
                  ))}
                </ul>

                <div className="mt-8 flex flex-wrap gap-3">
                  {active.status !== "clear" && (
                    <button
                      type="button"
                      onClick={() =>
                        updateDocument(projectId, active.id, {
                          status: "clear",
                        })
                      }
                      className="bg-ink px-4 py-2.5 text-sm font-medium text-paper hover:bg-forest"
                    >
                      Mark cleared
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      removeDocument(projectId, active.id);
                      setActiveId(null);
                    }}
                    className="border border-line px-4 py-2.5 text-sm text-steel hover:border-ink hover:text-ink"
                  >
                    Remove
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
