import { Suspense } from "react";
import BookInfoView from "@/components/BookInfoView";

export const metadata = { title: "Информация о книге" };

// id берётся на клиенте (useParams), как на странице редактирования, —
// так маршрут остаётся совместимым с cacheComponents.
export default function BookInfoPage() {
  return (
    <Suspense fallback={<p className="p-16 text-center text-stone-500">Загрузка…</p>}>
      <BookInfoView />
    </Suspense>
  );
}
