import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import MessagesView from "@/components/MessagesView";
import { getSessionUser } from "@/lib/auth";
import { checkChatAccess } from "@/lib/chatAccess";

export const metadata = { title: "Сообщения — Kitapta" };

/**
 * Уровень 2 (маршрутизация): роль проверяется на сервере по подписанной cookie сессии.
 * admin и moderator уходят со страницы до отрисовки; гость видит приглашение войти (в MessagesView).
 */
async function ChatRouteGuard({ children }: { children: React.ReactNode }) {
  await connection();
  const user = await getSessionUser();
  if (user) {
    const d = checkChatAccess({ id: user.id, name: user.name, role: user.role });
    if (!d.ok) redirect(user.role === "admin" ? "/admin" : "/moderation/queue");
  }
  return <>{children}</>;
}

export default function MessagesPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-extrabold text-stone-900">Сообщения</h1>
      <p className="mt-2 mb-6 text-stone-500">Переписка с владельцами книг и читателями.</p>
      <Suspense fallback={null}>
        <ChatRouteGuard>
          <Suspense fallback={null}>
            <MessagesView />
          </Suspense>
        </ChatRouteGuard>
      </Suspense>
    </div>
  );
}
