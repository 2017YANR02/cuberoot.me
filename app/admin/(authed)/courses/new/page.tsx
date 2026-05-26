import { PageHeader } from "../../../_components/Shell";
import { CourseForm } from "../_Form";

export default function NewCoursePage() {
  return (
    <div>
      <PageHeader title="新建课程" />
      <CourseForm />
    </div>
  );
}
