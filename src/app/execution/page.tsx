import Link from "next/link";
import { FeaturePageShell } from "@/components/FeaturePageShell";

const capabilities = [
  {
    href: "/execution/documents",
    title: "Document Review",
    copy: "Structured checks on purchase agreements, titles, and environmental reports.",
  },
  {
    href: "/execution/progress",
    title: "Progress & Schedule",
    copy: "Track milestones, surface slippage, and keep delivery under control.",
  },
];

export const metadata = {
  title: "Execution & Management",
};

export default function ExecutionPage() {
  return (
    <FeaturePageShell
      eyebrow="Execution & Management"
      title="Diligence and delivery, under one roof."
      description="Review critical transaction documents, then manage progress and schedule as the project moves from close to construction."
      cta={{ label: "Open a workspace", href: "/workspace" }}
    >
      <div className="grid gap-8 md:grid-cols-2">
        {capabilities.map((item, i) => (
          <Link
            key={item.href}
            href={item.href}
            className="group border-t border-ink pt-6 transition hover:border-copper"
          >
            <span className="font-mono text-xs text-copper">0{i + 1}</span>
            <h2 className="mt-3 font-display text-2xl text-ink group-hover:text-forest">
              {item.title}
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-steel">{item.copy}</p>
            <span className="mt-6 inline-block text-sm text-copper">
              Open →
            </span>
          </Link>
        ))}
      </div>
    </FeaturePageShell>
  );
}
