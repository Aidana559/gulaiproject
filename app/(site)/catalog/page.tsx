import { Suspense } from "react";
import CatalogView from "@/components/CatalogView";

export const metadata = { title: "Каталог — Page2Page" };

export default function CatalogPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-extrabold text-stone-900">Каталог</h1>
      <p className="mt-2 mb-8 text-stone-500">
        Книги, учебники, методички и манга от студентов.
      </p>
      <Suspense fallback={<p className="text-stone-500">Загрузка…</p>}>
        <CatalogView />
      </Suspense>
    </div>
  );
}
