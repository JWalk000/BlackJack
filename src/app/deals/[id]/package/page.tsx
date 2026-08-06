import { BankPackage } from "@/components/BankPackage";

export default async function BankPackagePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <BankPackage id={id} />;
}
