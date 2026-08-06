import { DealEditorClient } from "@/components/DealClients";

export default async function DealPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <DealEditorClient id={id} />;
}
