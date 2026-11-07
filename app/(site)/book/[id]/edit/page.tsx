import { Suspense } from "react";
import EditBookForm from "./EditBookForm";

export default function EditBookPage() {
  return (
    <Suspense fallback={<p className="p-10 text-center text-stone-500">Загрузка…</p>}>
      <EditBookForm />
    </Suspense>
  );
}
