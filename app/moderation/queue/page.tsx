import PageTitle from "@/components/staff/PageTitle";
import QueuePanel from "@/components/staff/QueuePanel";

export default function ModerationQueuePage() {
  return (
    <>
      <PageTitle
        title="Очередь на проверку"
        hint="Новые объявления, которые ещё никто не смотрел: одобрите или скройте с причиной."
      />
      <QueuePanel />
    </>
  );
}