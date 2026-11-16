"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { FiArrowRight, FiCheck, FiInfo } from "react-icons/fi";
import type { Book } from "@/data/books";
import { useAuth } from "@/components/AuthProvider";
import { refreshBookStates, useBookStatus } from "@/components/BookStatusBadge";
import { announceBookingsChanged, subscribeBookingsChanged } from "@/lib/bookings-sync";
import ContactOwnerButton from "@/components/ContactOwnerButton";
import { LIBRARY } from "@/lib/library-config";

export default function ReserveButton({ 
  book, 
  ownerKey, 
  hasOwnerAccount = false, 
  isLibrary = false 
}: { 
  book: Book; 
  ownerKey?: string; 
  hasOwnerAccount?: boolean; 
  isLibrary?: boolean 
}) {
  const router = useRouter();
  const { user } = useAuth();
  const status = useBookStatus(book.id);
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");
  const [error, setError] = useState("");
  const [hasActiveBooking, setHasActiveBooking] = useState(false);
  const [checking, setChecking] = useState(true);

  const checkBooking = useCallback(async () => {
    if (!user || user.role !== "user") {
      setHasActiveBooking(false);
      setChecking(false);
      return;
    }
    try {
      const response = await fetch("/api/bookings?scope=mine", { cache: "no-store" });
      if (!response.ok) throw new Error("Ошибка проверки брони");
      const data = await response.json();
      setHasActiveBooking((data.bookings ?? []).some(
        (b: { bookId: number | string; status: string }) =>
          String(b.bookId) === String(book.id) &&
          ["reserved", "borrowed", "overdue"].includes(b.status),
      ));
    } catch {
      setHasActiveBooking(false);
    } finally {
      setChecking(false);
    }
  }, [book.id, user?.id, user?.role]);

  useEffect(() => {
    void checkBooking();
    const unsubscribe = subscribeBookingsChanged(() => { void checkBooking(); });
    const onFocus = () => { void checkBooking(); };
    window.addEventListener("focus", onFocus);
    return () => {
      unsubscribe();
      window.removeEventListener("focus", onFocus);
    };
  }, [checkBooking]);

  async function reserve() {
    setError("");
    setState("loading");
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookId: book.id, bookTitle: book.title, bookAuthor: book.author }),
      });

      if (res.status === 401) {
        setState("idle");
        router.push("/login");
        return;
      }

      const json = await res.json().catch(() => ({}));
      await refreshBookStates(true);
      if (res.ok) announceBookingsChanged();

      if (!res.ok) {
        setError(json.error ?? "Не удалось забронировать");
        setState("idle");
        return;
      }
      setHasActiveBooking(true);
      setState("done");
    } catch {
      setError("Нет связи с сервером");
      setState("idle");
    }
  }

  // администратор и модератор не бронируют книги
  if (user && (user.role === "admin" || user.role === "moderator")) {
    return (
      <span className="inline-flex items-center gap-2 rounded-xl bg-stone-100 px-6 py-3 text-base font-semibold text-stone-600">
        <FiInfo /> Админ и модератор не бронируют книги
      </span>
    );
  }

  // владелец не может бронировать собственную книгу
  if (user && ownerKey && (String(user.id) === ownerKey || user.name === ownerKey)) {
    return (
      <span className="inline-flex items-center gap-2 rounded-xl bg-stone-100 px-6 py-3 text-base font-semibold text-stone-600">
        <FiInfo /> Это ваша книга
      </span>
    );
  }

  if (state === "done" || hasActiveBooking) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <span className="inline-flex items-center gap-2 rounded-xl bg-emerald-100 px-6 py-3 text-base font-semibold text-emerald-800">
          <FiCheck /> Забронирована
        </span>
        {isLibrary ? (
          <div className="w-full rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-stone-800">
            <p className="font-semibold">Заберите книгу в библиотеке</p>
            <p className="mt-1">{LIBRARY.name} · {LIBRARY.address}</p>
            <a href={LIBRARY.mapUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block font-semibold text-indigo-700 underline">Открыть в 2ГИС</a>
          </div>
        ) : ownerKey ? (
          <ContactOwnerButton bookId={book.id} ownerKey={ownerKey} hasOwnerAccount={hasOwnerAccount} />
        ) : null}
        <Link href="/profile" className="inline-flex items-center gap-1 text-sm font-semibold text-indigo-600 hover:underline">
          Мои брони <FiArrowRight />
        </Link>
        <Link href="/transactions" className="inline-flex items-center gap-1 text-sm font-semibold text-indigo-600 hover:underline">
          Транзакции <FiArrowRight />
        </Link>
      </div>
    );
  }

  const label =
    status === "given"
      ? "Сейчас на руках"
      : status === "reserved"
        ? "Уже забронирована"
        : state === "loading"
          ? "Подождите…"
          : "Забронировать";

  return (
    <div>
      <button
        type="button"
        onClick={reserve}
        disabled={status !== "available" || state === "loading" || checking}
        className="rounded-xl bg-indigo-600 px-6 py-3 text-base font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {label}
      </button>
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}