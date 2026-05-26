import { notFound } from "next/navigation";
import { findById } from "@/lib/db/courses";
import { PageHeader } from "../../../_components/Shell";
import { CourseForm } from "../_Form";

export default async function EditCoursePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const course = await findById(id);
  if (!course) notFound();
  return (
    <div>
      <PageHeader title="编辑课程" subtitle={course.title} />
      <CourseForm initial={course} />
    </div>
  );
}
