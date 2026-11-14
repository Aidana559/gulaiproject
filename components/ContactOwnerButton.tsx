"use client";

import { FiMessageCircle } from "react-icons/fi";
import { LinkButton } from "@/components/Button";
import { useAuth } from "@/components/AuthProvider";

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
  if (loading || !hasOwnerAccount) return null;
  if (user && (String(user.id) === ownerKey || user.name === ownerKey)) return null;

  return (
    <LinkButton href={`/messages?book=${encodeURIComponent(String(bookId))}`} variant="secondary" size="lg">
      <FiMessageCircle /> Написать владельцу
    </LinkButton>
  );
}
