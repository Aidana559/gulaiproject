import PageTitle from "@/components/staff/PageTitle";
import ReportsPanel from "@/components/staff/ReportsPanel";

export default function AdminReportsPage() {
  return (
    <>
      <PageTitle title="Жалобы" hint="Жалобы на книги и отзывы: закрыть, скрыть, удалить." />
      <ReportsPanel />
    </>
  );
}
