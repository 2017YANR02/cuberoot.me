import { notFound } from "next/navigation";
import { findById } from "@/lib/db/events";
import { PageHeader } from "../../../_components/Shell";
import { EventForm } from "../_Form";

export default async function EditEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const e = await findById(id);
  if (!e) notFound();
  return (
    <div>
      <PageHeader title="编辑赛事" subtitle={e.title} />
      <EventForm initial={e} />
    </div>
  );
}
