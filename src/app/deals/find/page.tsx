import type { Metadata } from "next";
import { DealFinder } from "@/components/DealFinder";

export const metadata: Metadata = {
  title: "Find deals — Estate",
  description:
    "Screen Houston free CAD parcels and pasted leads against ZHVI area averages. Assessor values, not MLS list prices. Not ATTOM.",
};

export default function FindDealsPage() {
  return <DealFinder />;
}
