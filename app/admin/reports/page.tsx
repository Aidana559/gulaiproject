import PageTitle from "@/components/staff/PageTitle";
import ReportsPanel from "@/components/staff/ReportsPanel";

export default function AdminReportsPage() {
  return (
    <>
      <PageTitle title="Жалобы" hint="Текущие жалобы и история рассмотрения: кто, когда и какое решение принял." />
      <ReportsPanel />
    </>
  );
}
