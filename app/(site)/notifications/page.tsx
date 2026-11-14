import { Suspense } from "react";
import NotificationsHistory from "@/components/NotificationsHistory";

export const metadata = { title: "Уведомления" };

export default function NotificationsPage() {
  return (
    <Suspense fallback={<p className="p-16 text-center text-stone-500">Загрузка…</p>}>
      <NotificationsHistory />
    </Suspense>
  );
}
