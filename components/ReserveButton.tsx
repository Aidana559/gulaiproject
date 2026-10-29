"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Book } from "@/data/books";

export default function ReserveButton({ book }: { book: Book }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");
  const [error, setError] = useState("");

  const unavailable = book.status !== "available";

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
      if (!res.ok) {
        setError(json.error ?? "Не удалось забронировать");
        setState("idle");
        return;
      }
      setState("done");
    } catch {
      setError("Нет связи с сервером");
      setState("idle");
    }
  }

  if (state === "done") {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded-xl bg-emerald-100 px-6 py-3 text-base font-semibold text-emerald-800">
          Забронирована ✓
        </span>
        <Link href="/profile" className="text-sm font-semibold text-indigo-600 hover:underline">
          Мои брони →
        </Link>
        <Link href="/transactions" className="text-sm font-semibold text-indigo-600 hover:underline">
          Транзакции →
        </Link>
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={reserve}
        disabled={unavailable || state === "loading"}
        className="rounded-xl bg-indigo-600 px-6 py-3 text-base font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {unavailable ? "Недоступна" : state === "loading" ? "Подождите…" : "Забронировать"}
      </button>
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}