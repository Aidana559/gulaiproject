"use client";

import { useCallback, useEffect, useState } from "react";
import { FiMessageCircle } from "react-icons/fi";
import { LinkButton } from "@/components/Button";
import { useAuth } from "@/components/AuthProvider";
import { subscribeBookingsChanged } from "@/lib/bookings-sync";
import { useChatSession } from "@/lib/chatStore";

const ACTIVE_STATUSES = new Set(["reserved", "borrowed", "overdue"]);

export default function ContactOwnerButton({
  bookId,
  ownerKey,
  hasOwnerAccount,
}: {
  bookId: string | number;
  ownerKey: string;
  hasOwnerAccount: boolean;
}) {
  const { user, loading } = useAuth();
  const chat = useChatSession();
  const [hasActiveBooking, setHasActiveBooking] = useState(false);

  const checkMyBooking = useCallback(async () => {
    if (!user?.id) {
      setHasActiveBooking(false);
      return;
    }
    if (String(user.id) === String(ownerKey) || user.name === ownerKey) {
      setHasActiveBooking(false);
      return;
    }
    try {
      const res = await fetch("/api/bookings?scope=mine", { cache: "no-store" });
      if (!res.ok) {
        setHasActiveBooking(false);
        return;
      }
      const json = await res.json().catch(() => ({}));
      const bookings = (json.bookings ?? []) as { bookId: number | string; status: string }[];
      const active = bookings.some(
        (b) => String(b.bookId) === String(bookId) && ACTIVE_STATUSES.has(b.status),
      );
      setHasActiveBooking(active);
    } catch {
      setHasActiveBooking(false);
    }
  }, [user, bookId, ownerKey]);

  useEffect(() => {
    if (loading) return;
    void checkMyBooking();
    const off = subscribeBookingsChanged(() => {
      void checkMyBooking();
    });
    return off;
  }, [loading, checkMyBooking]);

  if (loading || !hasOwnerAccount) return null;
  if (chat.status !== "ok") return null;
  if (user && (String(user.id) === ownerKey || user.name === ownerKey)) return null;
  if (!chat.peers?.has(ownerKey)) return null;
  if (!hasActiveBooking) return null;

  return (
    <LinkButton href={`/messages?book=${encodeURIComponent(String(bookId))}`} variant="secondary" size="lg">
      <FiMessageCircle /> Написать владельцу
    </LinkButton>
  );
}