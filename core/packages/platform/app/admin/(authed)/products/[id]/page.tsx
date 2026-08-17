import { notFound } from "next/navigation";
import { findById } from "@/lib/db/products";
import { PageHeader } from "../../../_components/Shell";
import { ProductForm } from "../_Form";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const p = await findById(id);
  if (!p) notFound();
  return (
    <div>
      <PageHeader title="编辑商品" subtitle={p.name} />
      <ProductForm initial={p} />
    </div>
  );
}
