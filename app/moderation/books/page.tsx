import PageTitle from "@/components/staff/PageTitle";
import BooksPanel from "@/components/staff/BooksPanel";

export default function ModerationBooksPage() {
  return (
    <>
      <PageTitle title="Объявления" hint="Скрыть, показать, изменить или удалить объявление." />
      <BooksPanel />
    </>
  );
}
