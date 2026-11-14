"use client";

import { FiMessageCircle } from "react-icons/fi";
import { LinkButton } from "@/components/Button";
import { useAuth } from "@/components/AuthProvider";
import { useChatSession } from "@/lib/chatStore";

/** «Написать владельцу»: скрыта для автора книги (проверка так же, как в BookActions). */
export default function ContactOwnerButton({
  bookId,
  ownerKey,
  hasOwnerAccount,
}: {
  bookId: string | number;
  ownerKey: string;
  /** у книги есть владелец-пользователь (книги каталога без ownerId — «Библиотека» — писать некому) */
  hasOwnerAccount: boolean;
}) {
  const { user, loading } = useAuth();
  const chat = useChatSession();
  if (loading || !hasOwnerAccount) return null;
  // admin / moderator кнопки не видят; писать можно только владельцу с ролью user
  if (chat.status !== "ok") return null;
  if (user && (String(user.id) === ownerKey || user.name === ownerKey)) return null;
  if (!chat.peers?.has(ownerKey)) return null;

  return (
    <LinkButton href={`/messages?book=${encodeURIComponent(String(bookId))}`} variant="secondary" size="lg">
      <FiMessageCircle /> Написать владельцу
    </LinkButton>
  );
}
