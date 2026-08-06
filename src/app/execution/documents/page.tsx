import Link from "next/link";
import { FeaturePageShell } from "@/components/FeaturePageShell";

export const metadata = {
  title: "Document Review",
};

export default function DocumentsPage() {
  return (
    <FeaturePageShell
      eyebrow="Execution · Document Review"
      title="Checks on agreements, titles, and environmental reports."
      description="Upload diligence packages into a project workspace. Estate runs a simulated AI review for exceptions, contingencies, and risk language — no external API required."
      cta={{ label: "Open document workspace", href: "/workspace" }}
    >
      <div className="grid gap-8 md:grid-cols-3">
        {[
          {
            title: "Upload",
            copy: "Drop PSAs, title commitments, Phase I reports, and surveys into a project.",
          },
          {
            title: "Simulated AI review",
            copy: "Clause and keyword heuristics flag liens, easements, contingencies, and environmental risk.",
          },
          {
            title: "Clear & track",
            copy: "Mark findings cleared and keep status with the rest of the project schedule.",
          },
        ].map((item, i) => (
          <div key={item.title} className="border-t border-ink pt-5">
            <span className="font-mono text-xs text-copper">0{i + 1}</span>
            <h2 className="mt-2 font-display text-2xl text-ink">{item.title}</h2>
            <p className="mt-2 text-sm text-steel">{item.copy}</p>
          </div>
        ))}
      </div>
      <p className="mt-10 text-sm text-steel">
        Already have an account?{" "}
        <Link href="/workspace" className="text-copper hover:text-copper-deep">
          Go to workspace
        </Link>
      </p>
    </FeaturePageShell>
  );
}
