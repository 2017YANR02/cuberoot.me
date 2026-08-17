import { notFound } from "next/navigation";
import { getAlgorithmById } from "@/lib/db/algorithms";
import { PageHeader } from "../../../_components/Shell";
import { AlgorithmForm } from "../_Form";

export const dynamic = "force-dynamic";

export default async function EditAlgorithmPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const a = await getAlgorithmById(id);
  if (!a) notFound();
  return (
    <div>
      <PageHeader title="编辑公式" subtitle={`${a.category} · ${a.name}`} />
      <AlgorithmForm initial={a} />
    </div>
  );
}
