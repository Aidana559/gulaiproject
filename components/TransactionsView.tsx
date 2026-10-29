"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  addDays,
  formatDate,
  txLabels,
  txStyles,
  type TxStatus,
} from "@/data/transactions";
import { removeTransaction, updateTransaction, useTransactions } from "@/lib/txStore";
import { Button } from "./Button";
import { inputClass } from "./FormField";

type SortKey = "due-asc" | "due-desc" | "start-desc" | "title";

const statuses = Object.keys(txLabels) as TxStatus[];

export default function TransactionsView() {
  const items = useTransactions();
  const [status, setStatus] = useState<TxStatus | "all" | "active">("active");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("due-asc");

  const update = updateTransaction;

  const counts = useMemo(() => {
    const c = { reserved: 0, borrowed: 0, overdue: 0, returned: 0 } as Record<TxStatus, number>;
    items.forEach((t) => c[t.status]++);
    return c;
  }, [items]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items
      .filter((t) =>
        status === "all" ? true : status === "active" ? t.status !== "returned" : t.status === status,
      )
      .filter(
        (t) =>
          !q || t.book.title.toLowerCase().includes(q) || t.person.toLowerCase().includes(q),
      )
      .sort((a, b) => {
        switch (sort) {
          case "due-asc":
            return a.dueDate.localeCompare(b.dueDate);
          case "due-desc":
            return b.dueDate.localeCompare(a.dueDate);
          case "start-desc":
            return b.startDate.localeCompare(a.startDate);
          default:
            return a.book.title.localeCompare(b.book.title, "ru");
        }
      });
  }, [items, status, query, sort]);

  const tiles: { key: TxStatus; icon: string }[] = [
    { key: "reserved", icon: "📌" },
    { key: "borrowed", icon: "📖" },
    { key: "overdue", icon: "⏰" },
    { key: "returned", icon: "✅" },
  ];

  return (
    <div>
      {/* Счётчики */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {tiles.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setStatus(t.key)}
            className={`rounded-2xl bg-white p-5 text-left ring-1 transition hover:shadow-md ${
              status === t.key ? "ring-2 ring-indigo-600" : "ring-stone-200"
            }`}
          >
            <p className="text-2xl">{t.icon}</p>
            <p className="mt-2 text-3xl font-extrabold text-stone-900">{counts[t.key]}</p>
            <p className="text-sm text-stone-500">{txLabels[t.key]}</p>
          </button>
        ))}
      </div>

      {/* Фильтры */}
      <div className="mt-6 flex flex-wrap gap-2">
        <Button size="sm" variant={status === "active" ? "primary" : "outline"} onClick={() => setStatus("active")}>
          Активные
        </Button>
        <Button size="sm" variant={status === "all" ? "primary" : "outline"} onClick={() => setStatus("all")}>
          Все
        </Button>
        {statuses.map((s) => (
          <Button key={s} size="sm" variant={status === s ? "primary" : "outline"} onClick={() => setStatus(s)}>
            {txLabels[s]}
          </Button>
        ))}
      </div>

      <div className="mt-4 grid gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-200 sm:grid-cols-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Поиск по книге или имени"
          aria-label="Поиск"
          className={inputClass}
        />
        <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="Сортировка" className={inputClass}>
          <option value="due-asc">Срок возврата: ближайшие</option>
          <option value="due-desc">Срок возврата: дальние</option>
          <option value="start-desc">Сначала новые</option>
          <option value="title">По названию книги</option>
        </select>
      </div>

      <p className="mt-5 text-sm text-stone-500">
        Найдено: <b className="text-stone-800">{filtered.length}</b>
      </p>

      {/* Список */}
      {filtered.length === 0 ? (
        <div className="mt-6 rounded-2xl bg-white p-12 text-center ring-1 ring-stone-200">
          <p className="text-4xl">📭</p>
          <p className="mt-3 font-semibold text-stone-800">Транзакций нет</p>
        </div>
      ) : (
        <ul className="mt-4 space-y-3">
          {filtered.map((t) => (
            <li
              key={t.id}
              className="flex flex-col gap-4 rounded-2xl bg-white p-4 ring-1 ring-stone-200 lg:flex-row lg:items-center lg:justify-between"
            >
              <div className="flex items-center gap-4">
                <div className={`h-20 w-14 shrink-0 rounded-md bg-gradient-to-br ${t.book.gradient} shadow`} />
                <div>
                  <Link href={`/book/${t.book.id}`} className="font-semibold text-stone-900 hover:text-indigo-600">
                    {t.book.title}
                  </Link>
                  <p className="text-sm text-stone-500">{t.book.author}</p>
                  <p className="mt-1 text-sm text-stone-700">
                    {t.status === "reserved" ? "Хочет взять: " : t.status === "returned" ? "Брал(а): " : "На руках у: "}
                    <b>{t.person}</b>
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm lg:flex lg:gap-8">
                <div>
                  <p className="text-xs text-stone-400">{t.status === "reserved" ? "Бронь с" : "Выдана"}</p>
                  <p className="font-medium">{formatDate(t.startDate)}</p>
                </div>
                <div>
                  <p className="text-xs text-stone-400">Вернуть до</p>
                  <p className={`font-medium ${t.status === "overdue" ? "text-rose-600" : ""}`}>{formatDate(t.dueDate)}</p>
                </div>
                <span
                  className={`col-span-2 inline-flex h-fit w-fit items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${txStyles[t.status]}`}
                >
                  {txLabels[t.status]}
                </span>
              </div>

              <div className="flex flex-wrap gap-2">
                {t.status === "reserved" && (
                  <>
                    <Button size="sm" onClick={() => update(t.id, { status: "borrowed" })}>
                      Выдать
                    </Button>
                    <Button size="sm" variant="danger" onClick={() => removeTransaction(t.id)}>
                      Отменить бронь
                    </Button>
                  </>
                )}
                {(t.status === "borrowed" || t.status === "overdue") && (
                  <>
                    <Button size="sm" onClick={() => update(t.id, { status: "returned" })}>
                      Принять возврат
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => update(t.id, { dueDate: addDays(t.dueDate, 7), status: "borrowed" })}
                    >
                      Продлить на 7 дн.
                    </Button>
                  </>
                )}
                {t.status === "returned" && <span className="text-sm text-stone-400">Завершено</span>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}