import Link from "next/link";
import { FeaturePageShell } from "@/components/FeaturePageShell";

const capabilities = [
  {
    href: "/plan/screening",
    title: "Site Screening",
    copy: "Analyze property records, setbacks, and local zoning to flag constraints before design begins.",
  },
  {
    href: "/plan/generative",
    title: "Generative Design",
    copy: "Instantly erect spatial programming for units and mix options against site capacity.",
  },
  {
    href: "/plan/cost",
    title: "Cost Modeling",
    copy: "Regional rehab or new-build cost linked to flip and rent / BRRRR returns.",
  },
];

export const metadata = {
  title: "Plan & Design",
};

export default function PlanPage() {
  return (
    <FeaturePageShell
      eyebrow="Plan & Design"
      title="From parcel data to a buildable program."
      description="Screen the site, generate unit mixes, and pressure-test cost before you commit to drawings or acquisition."
      cta={{ label: "Start with screening", href: "/plan/screening" }}
    >
      <div className="grid gap-8 md:grid-cols-3">
        {capabilities.map((item, i) => (
          <Link
            key={item.href}
            href={item.href}
            className="group border-t border-ink pt-6 transition hover:border-copper"
          >
            <span className="font-mono text-xs text-copper">
              0{i + 1}
            </span>
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
