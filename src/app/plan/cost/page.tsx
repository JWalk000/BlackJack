import { FeaturePageShell } from "@/components/FeaturePageShell";
import { CostModeling } from "@/components/CostModeling";

export const metadata = {
  title: "Cost Modeling",
};

export default function CostPage() {
  return (
    <FeaturePageShell
      eyebrow="Plan & Design · Cost Modeling"
      title="Build cost and deal returns in one model."
      description="Rehab a house, build duplexes or townhomes, or stand up garden / mid-rise multifamily. Regional construction cost links to flip and rent / BRRRR returns."
    >
      <CostModeling />
    </FeaturePageShell>
  );
}
