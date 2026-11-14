"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useChatSession } from "@/lib/chatStore";

/**
 * Имя или аватар пользователя как ссылка на его публичный профиль.
 *
 * Ссылкой это становится только если у пользователя есть публичный профиль (роль `user`, не заблокирован —
 * это тот же серверный справочник, что и у чатов) и смотрит вошедший `user`. Для гостя, admin / moderator,
 * а также для имён без аккаунта (книги каталога «Библиотека», демо-читатели) остаётся обычный текст.
 * Свою карточку открывает личный профиль (/profile).
 */
export default function UserLink({
  userId,
  className = "",
  title,
  children,
}: {
  userId?: string | number | null;
  className?: string;
  title?: string;
  children: ReactNode;
}) {
  const chat = useChatSession();
  const id = userId == null ? "" : String(userId);
  const linkable = !!id && chat.status === "ok" && !!chat.peers?.has(id);
  if (!linkable) return <span className={className}>{children}</span>;

  const href = chat.me?.id === id ? "/profile" : `/user/${encodeURIComponent(id)}`;
  return (
    <Link
      href={href}
      title={title ?? "Открыть профиль"}
      className={`${className} rounded-md transition hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600`}
    >
      {children}
    </Link>
  );
}
