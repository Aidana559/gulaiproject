"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useChatSession } from "@/lib/chatStore";


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
  const { user } = useAuth();
  const staff = user?.role === "admin" || user?.role === "moderator";
  const id = userId == null ? "" : String(userId);
  const linkable = !!id && !!user && (staff || String(user.id) === id || (chat.status === "ok" && !!chat.peers?.has(id)));
  if (!linkable) return <span className={className}>{children}</span>;

  const href = String(user?.id) === id ? "/profile" : `/user/${encodeURIComponent(id)}`;
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
