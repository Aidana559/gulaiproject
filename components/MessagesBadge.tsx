"use client";

import { useChatSession, useUnreadTotal } from "@/lib/chatStore";

/** Счётчик непрочитанных сообщений в меню. */
export default function MessagesBadge() {
  const chat = useChatSession();
  const n = useUnreadTotal();
  if (chat.status !== "ok" || !n) return null;
  return (
    <span className="ml-1.5 inline-flex min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 text-xs font-bold text-white">
      {n > 99 ? "99+" : n}
    </span>
  );
}
