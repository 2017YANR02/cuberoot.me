import { notFound } from "next/navigation";
import { findById } from "@/lib/db/news";
import { PageHeader } from "../../../_components/Shell";
import { NewsForm } from "../_Form";

export default async function EditNewsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const n = await findById(id);
  if (!n) notFound();
  return (
    <div>
      <PageHeader title="编辑资讯" subtitle={n.title} />
      <NewsForm initial={n} />
    </div>
  );
}
