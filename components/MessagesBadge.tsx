"use client";

import { useAuth } from "@/components/AuthProvider";
import { useUnreadTotal } from "@/lib/chatStore";

/** Счётчик непрочитанных сообщений в меню. */
export default function MessagesBadge() {
  const { user } = useAuth();
  const n = useUnreadTotal(user ? { id: String(user.id), name: user.name } : null);
  if (!n) return null;
  return (
    <span className="ml-1.5 inline-flex min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 text-xs font-bold text-white">
      {n > 99 ? "99+" : n}
    </span>
  );
}
