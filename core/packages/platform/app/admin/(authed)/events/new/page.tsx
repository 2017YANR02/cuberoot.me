import { PageHeader } from "../../../_components/Shell";
import { EventForm } from "../_Form";

export default function NewEventPage() {
  return (
    <div>
      <PageHeader title="新建赛事" />
      <EventForm />
    </div>
  );
}
