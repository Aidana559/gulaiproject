import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import PublicProfileView from "@/components/PublicProfileView";
import { getSessionUser } from "@/lib/auth";
import { staffHomeFor } from "@/lib/listing-access";
import { canViewPublicProfiles } from "@/lib/profile-access";

export const metadata = { title: "Профиль пользователя — Kitapta" };

/**
 * Маршрутизация: роль проверяется на сервере по подписанной cookie сессии.
 * admin и moderator уходят со страницы до отрисовки (как со страницы «Сообщения»);
 * гость видит приглашение войти (в PublicProfileView). Сами данные API отдаёт только `user`.
 */
async function ProfileRouteGuard({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  const user = await getSessionUser();
  if (user && !canViewPublicProfiles(user.role)) redirect(staffHomeFor(user.role));
  return <PublicProfileView key={id} userId={id} />;
}

export default function UserProfilePage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <Suspense fallback={<p className="text-stone-500">Загрузка…</p>}>
        <ProfileRouteGuard params={params} />
      </Suspense>
    </div>
  );
}
