import { FeaturePageShell } from "@/components/FeaturePageShell";
import { DealFinder } from "@/components/DealFinder";

export const metadata = {
  title: "Deal Finder",
};

export default function DealsPage() {
  return (
    <FeaturePageShell
      eyebrow="Deal Finder"
      title="Where residential and multifamily deals still leave margin."
      description="Hunt vacant land and rebuild lots in Houston — then test single-family, duplex–fourplex, townhome, and multifamily product against regional build cost and local sale prices."
    >
      <DealFinder />
    </FeaturePageShell>
  );
}
