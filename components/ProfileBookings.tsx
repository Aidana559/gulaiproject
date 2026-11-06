"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { books } from "@/data/books";
import { formatDate, txLabels, txStyles, type TxStatus } from "@/data/transactions";
import { Button } from "./Button";

type Booking = {
  id: string;
  bookId: number;
  bookTitle: string;
  bookAuthor: string;
  status: TxStatus;
  startDate: string;
  dueDate: string;
};

const ACTIVE_FILTERS: { key: TxStatus | null; label: string }[] = [
  { key: null, label: "Все активные" },
  { key: "reserved", label: "Бронь" },
  { key: "borrowed", label: "На руках" },
  { key: "overdue", label: "Просрочена" },
  { key: "returned", label: "Возвращена" },
];

export default function ProfileBookings() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [tab, setTab] = useState<"active" | "cancelled">("active");
  const [filter, setFilter] = useState<TxStatus | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/bookings?scope=mine", { cache: "no-store" });
    if (res.ok) {
      const json = await res.json();
      setBookings(json.bookings ?? []);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function cancel(id: string) {
    await fetch(`/api/bookings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "cancel" }),
    });
    await load();
  }

  const cancelled = bookings.filter((b) => b.status === "cancelled");
  const active = bookings.filter((b) => b.status !== "cancelled");
  const pool = tab === "cancelled" ? cancelled : active;
  const visible =
    tab === "cancelled" || !filter ? pool : pool.filter((b) => b.status === filter);

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">Мои брони</h2>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            setTab("active");
            setFilter(null);
          }}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
            tab === "active"
              ? "bg-teal-800 text-white"
              : "bg-white text-slate-800 ring-1 ring-slate-300 hover:bg-slate-100"
          }`}
        >
          Активные ({active.length})
        </button>
        <button
          type="button"
          onClick={() => setTab("cancelled")}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
            tab === "cancelled"
              ? "bg-teal-800 text-white"
              : "bg-white text-slate-800 ring-1 ring-slate-300 hover:bg-slate-100"
          }`}
        >
          Отменённые ({cancelled.length})
        </button>
      </div>

      {tab === "active" && (
        <div className="mt-3 flex flex-wrap gap-2">
          {ACTIVE_FILTERS.map((f) => {
            const on = filter === f.key;
            return (
              <button
                key={String(f.key)}
                type="button"
                onClick={() => setFilter(on ? null : f.key)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  on
                    ? "bg-indigo-600 text-white"
                    : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
                }`}
              >
                {f.label}
              </button>
            );
          })}
        </div>
      )}

      {visible.length === 0 ? (
        <p className="mt-4 text-sm text-slate-600">
          {tab === "cancelled" ? "Отменённых броней нет." : "Пока нет броней."}
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {visible.map((b) => {
            const book = books.find((x) => x.id === b.bookId);
            const gradient = book?.gradient ?? "from-indigo-500 to-purple-600";
            return (
              <li
                key={b.id}
                className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-white p-4 ring-1 ring-stone-200"
              >
                <div className="flex items-center gap-4">
                  <div className={`h-16 w-12 shrink-0 rounded-md bg-gradient-to-br ${gradient}`} />
                  <div>
                    {book ? (
                      <Link
                        href={`/book/${book.id}`}
                        className="font-semibold text-stone-900 hover:text-indigo-600"
                      >
                        {b.bookTitle}
                      </Link>
                    ) : (
                      <p className="font-semibold text-stone-900">{b.bookTitle}</p>
                    )}
                    <p className="text-sm text-stone-500">{b.bookAuthor || "—"}</p>
                    <p className="mt-1 text-xs text-stone-400">
                      {formatDate(b.startDate)} → {formatDate(b.dueDate)}
                    </p>
                  </div>
                </div>
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${txStyles[b.status] ?? txStyles.cancelled}`}
                >
                  {txLabels[b.status] ?? b.status}
                </span>
                {b.status === "reserved" && (
                  <Button size="sm" variant="danger" onClick={() => cancel(b.id)}>
                    Отменить
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
