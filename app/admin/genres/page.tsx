import PageTitle from "@/components/staff/PageTitle";
import { GenresPanel } from "@/components/staff/TaxonomyPanels";

export default function AdminGenresPage() {
  return (
    <>
      <PageTitle title="Жанры" hint="Список жанров для книг: добавляйте, переименовывайте и удаляйте — формы и фильтры сайта обновятся сразу." />
      <GenresPanel />
    </>
  );
}
