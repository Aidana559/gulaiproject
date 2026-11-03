"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { api } from "@/lib/api";

export default function BookGuard({ bookId }: { bookId: string | number }) {
  const { user } = useAuth();
  const [gone, setGone] = useState(false);

  useEffect(() => {
    api(`/api/books/${bookId}`, user?.id)
      .then(() => setGone(false))
      .catch(() => setGone(true));
  }, [bookId, user]);

  if (!gone) return null;
  return (
    <div className="mb-6 rounded-xl bg-amber-50 p-4 text-amber-800 ring-1 ring-amber-200">
      Это объявление скрыто или удалено.
    </div>
  );
}