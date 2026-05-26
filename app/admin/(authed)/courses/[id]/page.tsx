import { notFound } from "next/navigation";
import { findById } from "@/lib/db/courses";
import { listByCourse as listLessons } from "@/lib/db/lessons";
import { list as listInstructors } from "@/lib/db/instructors";
import { PageHeader } from "../../../_components/Shell";
import { CourseForm } from "../_Form";
import { LessonsPanel } from "../_LessonsPanel";

export const dynamic = "force-dynamic";

export default async function EditCoursePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const course = await findById(id);
  if (!course) notFound();
  const [lessons, instructors] = await Promise.all([
    listLessons(id),
    listInstructors(),
  ]);
  return (
    <div>
      <PageHeader title="编辑课程" subtitle={course.title} />
      <CourseForm initial={course} instructors={instructors} />
      <LessonsPanel courseId={course.id} lessons={lessons} />
    </div>
  );
}
