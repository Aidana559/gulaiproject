import PageTitle from "@/components/staff/PageTitle";
import BooksPanel from "@/components/staff/BooksPanel";

export default function AdminBooksPage() {
  return (
    <>
      <PageTitle title="Объявления" hint="Все объявления, включая скрытые." />
      <BooksPanel />
    </>
  );
}
