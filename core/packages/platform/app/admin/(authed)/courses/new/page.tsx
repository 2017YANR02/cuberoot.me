import { PageHeader } from "../../../_components/Shell";
import { CourseForm } from "../_Form";
import { list as listInstructors } from "@/lib/db/instructors";

export const dynamic = "force-dynamic";

export default async function NewCoursePage() {
  const instructors = await listInstructors();
  return (
    <div>
      <PageHeader title="新建课程" />
      <CourseForm instructors={instructors} />
    </div>
  );
}
