"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FiMessageCircle } from "react-icons/fi";
import { useAuth } from "@/components/AuthProvider";
import { useUnreadTotal } from "@/lib/chatStore";

/** Иконка чата рядом с колокольчиком: ведёт в «Сообщения», со счётчиком непрочитанных. */
export default function MessagesIcon() {
  const { user } = useAuth();
  const pathname = usePathname();
  const unread = useUnreadTotal(user ? { id: String(user.id), name: user.name } : null);
  if (!user) return null;

  return (
    <Link
      href="/messages"
      aria-label={unread ? `Сообщения: ${unread} непрочитанных` : "Сообщения"}
      title="Сообщения"
      className={`relative rounded-full p-2 transition hover:bg-stone-100 hover:text-stone-900 ${
        pathname.startsWith("/messages") ? "text-indigo-700" : "text-stone-600"
      }`}
    >
      <FiMessageCircle className="text-xl" />
      {unread > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex min-w-[18px] items-center justify-center rounded-full bg-rose-600 px-1 text-[11px] font-bold leading-[18px] text-white">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </Link>
  );
}
