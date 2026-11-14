import PageTitle from "@/components/staff/PageTitle";
import ModerationLogPanel from "@/components/staff/ModerationLogPanel";

export default function ModerationLogPage() {
  return (
    <>
      <PageTitle title="Журнал действий" hint="Скрытия, удаления, восстановления и одобрения книг." />
      <ModerationLogPanel />
    </>
  );
}
