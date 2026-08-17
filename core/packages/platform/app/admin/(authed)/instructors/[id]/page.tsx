import { notFound } from "next/navigation";
import { findById } from "@/lib/db/instructors";
import { PageHeader } from "../../../_components/Shell";
import { InstructorForm } from "../_Form";

export default async function EditInstructorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const i = await findById(id);
  if (!i) notFound();
  return (
    <div>
      <PageHeader title="编辑讲师" subtitle={i.name} />
      <InstructorForm initial={i} />
    </div>
  );
}
