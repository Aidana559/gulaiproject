import PageTitle from "@/components/staff/PageTitle";
import { CategoriesPanel } from "@/components/staff/TaxonomyPanels";

export default function AdminCategoriesPage() {
  return (
    <>
      <PageTitle title="Категории" hint="Типы изданий: добавляйте, переименовывайте и удаляйте — меню и фильтры сайта обновятся сразу." />
      <CategoriesPanel />
    </>
  );
}
