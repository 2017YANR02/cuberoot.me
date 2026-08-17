import { PageHeader } from "../../../_components/Shell";
import { NewsForm } from "../_Form";

export default function NewNewsPage() {
  return (
    <div>
      <PageHeader title="新建资讯" />
      <NewsForm />
    </div>
  );
}
