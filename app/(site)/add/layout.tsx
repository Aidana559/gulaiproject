import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { canManageOwnListings, staffHomeFor } from "@/lib/listing-access";

/**
 * Маршрутная защита страницы добавления книги: роль проверяется на сервере по подписанной cookie.
 * admin и moderator перенаправляются в свою панель до отрисовки формы; гостя отправит на вход сама страница.
 */
async function AddRouteGuard({ children }: { children: React.ReactNode }) {
  await connection();
  const user = await getSessionUser();
  if (user && !canManageOwnListings(user.role)) redirect(staffHomeFor(user.role));
  return <>{children}</>;
}

export default function AddLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<p className="p-10 text-center text-stone-500">Загрузка…</p>}>
      <AddRouteGuard>{children}</AddRouteGuard>
    </Suspense>
  );
}
