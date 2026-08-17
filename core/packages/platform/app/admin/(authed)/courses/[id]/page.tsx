import { notFound } from "next/navigation";
import { findById } from "@/lib/db/courses";
import { listByCourse as listLessons } from "@/lib/db/lessons";
import { listByLesson as listQuizzesByLesson } from "@/lib/db/quizzes";
import { list as listInstructors } from "@/lib/db/instructors";
import type { Quiz } from "@/db/schema";
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
  // 各章节测验题(并行预取)→ lessonId -> Quiz[],传给 LessonsPanel 渲染出题面板。
  const quizLists = await Promise.all(
    lessons.map((l) => listQuizzesByLesson(l.id)),
  );
  const quizzesByLesson: Record<string, Quiz[]> = {};
  lessons.forEach((l, i) => {
    quizzesByLesson[l.id] = quizLists[i];
  });
  return (
    <div>
      <PageHeader title="编辑课程" subtitle={course.title} />
      <CourseForm initial={course} instructors={instructors} />
      <LessonsPanel
        courseId={course.id}
        lessons={lessons}
        quizzesByLesson={quizzesByLesson}
      />
    </div>
  );
}
