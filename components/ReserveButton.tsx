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

export default function ReserveButton({ book, ownerKey, hasOwnerAccount = false }: { book: Book; ownerKey?: string; hasOwnerAccount?: boolean }) {
  const router = useRouter();
  const { user } = useAuth();
  const status = useBookStatus(book.id);
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");
  const [error, setError] = useState("");
  const [hasActiveBooking, setHasActiveBooking] = useState(false);
  const [checking, setChecking] = useState(true);

  const checkMyBooking = useCallback(async () => {
    if (!user || user.role !== "user") {
      setHasActiveBooking(false);
      setChecking(false);
      return;
    }
    try {
      const res = await fetch("/api/bookings?scope=mine", { cache: "no-store" });
      if (!res.ok) throw new Error("Не удалось проверить бронирование");
      const data = await res.json();
      setHasActiveBooking((data.bookings ?? []).some(
        (b: { bookId: number | string; status: string }) =>
          String(b.bookId) === String(book.id) &&
          ["reserved", "borrowed", "overdue"].includes(b.status),
      ));
    } catch {
      // При ошибке проверки не показываем кнопку связи.
      setHasActiveBooking(false);
    } finally {
      setChecking(false);
    }
  }, [book.id, user?.id, user?.role]);

  useEffect(() => {
    void checkMyBooking();
    const unsubscribe = subscribeBookingsChanged(() => { void checkMyBooking(); });
    const onFocus = () => { void checkMyBooking(); };
    window.addEventListener("focus", onFocus);
    return () => {
      unsubscribe();
      window.removeEventListener("focus", onFocus);
    };
  }, [checkMyBooking]);

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
      await refreshBookStates(true); // метки везде обновляются сразу
      if (res.ok) announceBookingsChanged(); // и в других открытых вкладках (профиль владельца, каталог)

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
        {!checking && hasOwnerAccount && ownerKey && (
          <ContactOwnerButton bookId={book.id} ownerKey={ownerKey} hasOwnerAccount={hasOwnerAccount} />
        )}
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
        disabled={status !== "available" || state === "loading"}
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