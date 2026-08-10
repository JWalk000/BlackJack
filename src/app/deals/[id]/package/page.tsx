import { Suspense } from "react";
import { BankPackage } from "@/components/BankPackage";

export default async function BankPackagePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <Suspense
      fallback={
        <div className="px-6 py-20 text-sm text-muted">Loading package…</div>
      }
    >
      <BankPackage id={id} />
    </Suspense>
  );
}
