import { uid } from "./id";
import type { DocType, Finding, ProjectDocument } from "./types";

const TEMPLATES: Record<DocType, Finding[]> = {
  agreement: [
    {
      id: "a1",
      severity: "warn",
      text: "Earnest money release appears tied to environmental clearance — confirm the cure period aligns with diligence calendar.",
    },
    {
      id: "a2",
      severity: "info",
      text: "Assignment clause limits transfer without seller consent — review against JV or SPE structure.",
    },
    {
      id: "a3",
      severity: "critical",
      text: "Financing contingency window may expire before permit submission — flag for counsel.",
    },
    {
      id: "a4",
      severity: "warn",
      text: "Seller representations on zoning compliance lack backup exhibits — request zoning confirmation letter.",
    },
  ],
  title: [
    {
      id: "t1",
      severity: "critical",
      text: "Outstanding lien or exception language detected — require release or escrow holdback before close.",
    },
    {
      id: "t2",
      severity: "warn",
      text: "Utility or access easement noted along a lot line — verify against survey and setback model.",
    },
    {
      id: "t3",
      severity: "info",
      text: "Standard schedule B exceptions present; no mineral rights carve-out found in excerpt.",
    },
    {
      id: "t4",
      severity: "warn",
      text: "Access may rely on a private drive — confirm reciprocal easement is recorded and assignable.",
    },
  ],
  environmental: [
    {
      id: "e1",
      severity: "info",
      text: "No recognized environmental conditions (RECs) identified in the screened language.",
    },
    {
      id: "e2",
      severity: "warn",
      text: "Adjacent historical use (dry cleaner / industrial) referenced — confirm HREC disposition.",
    },
    {
      id: "e3",
      severity: "critical",
      text: "Language suggests further investigation (Phase II) may be warranted — escalate before PSA hard date.",
    },
    {
      id: "e4",
      severity: "info",
      text: "Floodplain / wetland language not flagged in available excerpt.",
    },
  ],
  survey: [
    {
      id: "s1",
      severity: "warn",
      text: "Possible encroachment or fence offset mentioned — reconcile with title exceptions.",
    },
    {
      id: "s2",
      severity: "info",
      text: "Setbacks appear consistent with multi-family district standards in the excerpt.",
    },
    {
      id: "s3",
      severity: "warn",
      text: "Easement corridor width may reduce buildable envelope — push into site screening.",
    },
  ],
  other: [
    {
      id: "o1",
      severity: "info",
      text: "Document classified as general diligence — no structured checklist matched; manual review advised.",
    },
    {
      id: "o2",
      severity: "warn",
      text: "Filename or contents suggest financial or operating data — confirm confidentiality handling.",
    },
  ],
};

const KEYWORD_BOOSTS: { pattern: RegExp; severity: Finding["severity"]; text: string }[] = [
  {
    pattern: /lien|judgment|encumbrance/i,
    severity: "critical",
    text: "Keyword match: lien / judgment / encumbrance language found in uploaded text.",
  },
  {
    pattern: /phase\s*ii|further investigation|recognized environmental/i,
    severity: "critical",
    text: "Keyword match: Phase II or REC-related language detected.",
  },
  {
    pattern: /easement|right[- ]of[- ]way/i,
    severity: "warn",
    text: "Keyword match: easement / right-of-way references found.",
  },
  {
    pattern: /contingency|earnest/i,
    severity: "warn",
    text: "Keyword match: contingency or earnest-money terms present.",
  },
  {
    pattern: /flood|wetland|hazard/i,
    severity: "warn",
    text: "Keyword match: flood / wetland / hazard language present.",
  },
];

function inferType(fileName: string, explicit?: DocType): DocType {
  if (explicit && explicit !== "other") return explicit;
  const n = fileName.toLowerCase();
  if (/psa|purchase|sale|agreement|apa/.test(n)) return "agreement";
  if (/title|commitment|policy|deed/.test(n)) return "title";
  if (/phase|enviro|esa|phase1|phase_1/.test(n)) return "environmental";
  if (/survey|alta|plat/.test(n)) return "survey";
  return explicit ?? "other";
}

function pickFindings(type: DocType, excerpt: string): Finding[] {
  const pool = TEMPLATES[type];
  const seed = (excerpt.length + type.length) % pool.length;
  const base = [pool[seed], pool[(seed + 1) % pool.length]];

  const fromText = KEYWORD_BOOSTS.filter((k) => k.pattern.test(excerpt)).map(
    (k) =>
      ({
        id: uid("find"),
        severity: k.severity,
        text: k.text,
      }) satisfies Finding,
  );

  const merged = [...fromText, ...base].slice(0, 4);
  return merged.map((f) => ({ ...f, id: uid("find") }));
}

function statusFromFindings(findings: Finding[]): ProjectDocument["status"] {
  if (findings.some((f) => f.severity === "critical")) return "issue";
  if (findings.some((f) => f.severity === "warn")) return "review";
  return "clear";
}

export function detectDocType(fileName: string): DocType {
  return inferType(fileName);
}

export async function runSimulatedReview(input: {
  fileName: string;
  type?: DocType;
  excerpt?: string;
}): Promise<Pick<ProjectDocument, "type" | "status" | "findings">> {
  const type = inferType(input.fileName, input.type);
  const excerpt = input.excerpt ?? "";

  await new Promise((r) => setTimeout(r, 1400 + Math.random() * 1000));

  const findings = pickFindings(type, excerpt || input.fileName);
  return {
    type,
    findings,
    status: statusFromFindings(findings),
  };
}

export async function readFileExcerpt(file: File): Promise<string> {
  if (
    file.type.startsWith("text/") ||
    /\.(txt|md|csv|json)$/i.test(file.name)
  ) {
    const text = await file.text();
    return text.slice(0, 8000);
  }
  return "";
}
