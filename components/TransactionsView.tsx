"use client";

import Link from "next/link";
import { FiBookmark, FiBookOpen, FiCheckCircle, FiClock, FiInbox } from "react-icons/fi";
import type { IconType } from "react-icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  formatDate,
  txLabels,
  txStyles,
  type TxStatus,
} from "@/data/transactions";
import { books, type Book } from "@/data/books";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "./Button";
import { inputClass } from "./FormField";
import {
  updateTransaction,
  useTransactions,
  useCatalogBooks,
} from "@/lib/txStore";

import { addDays } from "@/data/transactions";

type SortKey = "due-asc" | "due-desc" | "start-desc" | "title";
type Action = "issue" | "return" | "extend" | "cancel";

type Row = {
  id: string;
  book: { id: number | string; title: string; author: string; gradient: string; coverUrl?: string | null };
  person: string;
  status: TxStatus;
  startDate: string;
  dueDate: string;
  allowedActions: Action[];
  reliability?: Reliability;
};

type Reliability = { percent: number | null; onTime: number; total: number };

type ApiBooking = {
  id: string;
  bookId: number;
  bookTitle: string;
  bookAuthor: string;
  status: string;
  startDate: string;
  dueDate: string;
  userName?: string;
  userId?: string;
  allowedActions?: Action[];
  reliability?: Reliability;
};

const statuses = Object.keys(txLabels) as TxStatus[];

function toRow(b: ApiBooking, fallbackPerson: string, catalog: Map<number, Book>): Row {
  const found = catalog.get(Number(b.bookId)) ?? books.find((x) => x.id === b.bookId) ?? books.find((x) => x.title === b.bookTitle);
  return {
    id: b.id,
    book: {
      id: found?.id ?? b.bookId ?? 0,
      title: b.bookTitle,
      author: b.bookAuthor,
      gradient: found?.gradient ?? "from-indigo-500 to-purple-600",
      coverUrl: found?.coverUrl ?? null,
    },
    person: b.userName || fallbackPerson,
    status: (b.status === "confirmed" ? "reserved" : b.status) as TxStatus,
    startDate: b.startDate,
    dueDate: b.dueDate,
    allowedActions: b.allowedActions ?? [],
    reliability: b.reliability,
  };
}

/** Колонки таблицы на широких экранах: одинаковые для шапки и всех строк */
const COLS =
  "lg:grid lg:grid-cols-[3.5rem_minmax(0,1.6fr)_minmax(0,1.1fr)_7.5rem_7.5rem_7.5rem_13rem] lg:items-center lg:gap-4";

const ACTION_LABEL: Record<Action, string> = {
  issue: "Выдать",
  return: "Принять возврат",
  extend: "Продлить на 7 дн.",
  cancel: "Отменить бронь",
};

export default function TransactionsView() {
  const { user } = useAuth();
  const storeItems = useTransactions();
  const catalog = useCatalogBooks();
  const [serverBookings, setServerBookings] = useState<ApiBooking[]>([]);
  const [status, setStatus] = useState<TxStatus | "all" | "active">("active");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("due-asc");
  const [loading, setLoading] = useState(true);

  const loadServer = useCallback(async () => {
    try {
      const res = await fetch("/api/bookings", { cache: "no-store" });
      if (!res.ok) {
        setServerBookings([]);
        return;
      }
      const json = await res.json();
      setServerBookings(json.bookings ?? []);
    } catch {
      setServerBookings([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadServer();
  }, [loadServer]);

  const items = useMemo<Row[]>(() => {
    const person = user?.name ?? "Читатель";
    const fromServer = serverBookings
      .filter((b) => b.status !== "cancelled") // отменённые — в профиле
      .map((b) => toRow(b, person, catalog));

    // Демонстрационные транзакции других читателей из transactions.json / txStore.
    const fromStore: Row[] = storeItems.map((t) => ({
      id: `demo-${t.id}`,
      book: {
        id: t.book.id,
        title: t.book.title,
        author: t.book.author,
        gradient: t.book.gradient,
        coverUrl: t.book.coverUrl ?? null,
      },
      person: t.person,
      status: ((t.status as string) === "confirmed" ? "reserved" : t.status) as TxStatus,
      startDate: t.startDate,
      dueDate: t.dueDate,
      allowedActions: (() => {
        const book = books.find((b) => b.id === t.book.id);
        const isAdmin = user?.role === "admin" || user?.role === "moderator";
        const isOwner = book?.owner === user?.name;
        const isBorrower = t.person === user?.name;
        const isReserved = (t.status as string) === "reserved" || (t.status as string) === "confirmed";
        const actions: Action[] = [];

        // Бронь: «Выдать» — владелец/админ, «Отменить бронь» — владелец/админ/сам читатель
        if (isReserved) {
          if (isAdmin || isOwner) actions.push("issue");
          if (isAdmin || isOwner || isBorrower) actions.push("cancel");
        }

        if ((isAdmin || isOwner) && (t.status === "borrowed" || t.status === "overdue")) {
          actions.push("return");
          actions.push("extend");
        }

        return actions;
      })(),

    }));

    return [...fromServer, ...fromStore];
  }, [serverBookings, storeItems, user, catalog]);

async function act(t: Row, action: Action) {
  // Демонстрационные транзакции
  if (t.id.startsWith("demo-")) {
    const id = Number(t.id.replace("demo-", ""));

    const today = new Date().toISOString().slice(0, 10);

    switch (action) {
      case "cancel":
        updateTransaction(id, {
          status: "cancelled",
        });
        break;

      case "issue":
        updateTransaction(id, {
          status: "borrowed",
          startDate: today,
          dueDate: addDays(today, 14),
        });
        break;

      case "return":
        updateTransaction(id, {
          status: "returned",
        });
        break;

      case "extend":
        updateTransaction(id, {
          status: "borrowed",
          dueDate: addDays(
            t.dueDate < today ? today : t.dueDate,
            7
          ),
        });
        break;
    }

    return;
  }

  // Обычные серверные бронирования
  const res = await fetch(`/api/bookings/${t.id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ action }),
  });

  if (res.ok) {
    await loadServer();
  }
}

  const counts = useMemo(() => {
    const c = {
      reserved: 0,
      borrowed: 0,
      overdue: 0,
      returned: 0,
      cancelled: 0,
    } as Record<TxStatus, number>;
    items.forEach((t) => {
      if (t.status in c) c[t.status as TxStatus]++;
    });
    return c;
  }, [items]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items
      .filter((t) =>
        status === "all"
          ? true
          : status === "active"
            ? t.status !== "returned" && t.status !== "cancelled"
            : t.status === status,
      )
      .filter(
        (t) =>
          !q ||
          t.book.title.toLowerCase().includes(q) ||
          t.person.toLowerCase().includes(q),
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

  const tiles: { key: TxStatus; Icon: IconType }[] = [
    { key: "reserved", Icon: FiBookmark },
    { key: "borrowed", Icon: FiBookOpen },
    { key: "overdue", Icon: FiClock },
    { key: "returned", Icon: FiCheckCircle },
  ];

  if (!user) {
    return (
      <div className="rounded-2xl bg-white p-12 text-center ring-1 ring-stone-200">
        <p className="font-semibold text-stone-800">Войдите, чтобы видеть транзакции</p>
        <Link href="/login" className="mt-3 inline-block text-indigo-600 hover:underline">
          Войти
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {tiles.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setStatus(t.key)}
            className={`flex h-full flex-col rounded-2xl bg-white p-5 text-left ring-1 transition hover:shadow-md ${
              status === t.key ? "ring-2 ring-indigo-600" : "ring-stone-200"
            }`}
          >
            <t.Icon className="size-6 text-indigo-600" />
            <p className="mt-2 text-3xl font-extrabold text-stone-900">{counts[t.key] ?? 0}</p>
            <p className="text-sm text-stone-500">{txLabels[t.key]}</p>
          </button>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <Button
          size="sm"
          variant={status === "active" ? "primary" : "outline"}
          onClick={() => setStatus("active")}
        >
          Активные
        </Button>
        <Button
          size="sm"
          variant={status === "all" ? "primary" : "outline"}
          onClick={() => setStatus("all")}
        >
          Все
        </Button>
        {statuses
          .filter((s) => s !== "cancelled")
          .map((s) => (
            <Button
              key={s}
              size="sm"
              variant={status === s ? "primary" : "outline"}
              onClick={() => setStatus(s)}
            >
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
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          aria-label="Сортировка"
          className={inputClass}
        >
          <option value="due-asc">Срок возврата: ближайшие</option>
          <option value="due-desc">Срок возврата: дальние</option>
          <option value="start-desc">Сначала новые</option>
          <option value="title">По названию книги</option>
        </select>
      </div>

      <p className="mt-5 text-sm text-stone-500">
        Найдено: <b className="text-stone-800">{loading ? "…" : filtered.length}</b>
        {user.role === "admin" && (
          <span className="ml-2 text-xs text-stone-400">(все транзакции)</span>
        )}
      </p>

      {filtered.length === 0 ? (
        <div className="mt-6 rounded-2xl bg-white p-12 text-center ring-1 ring-stone-200">
          <FiInbox className="mx-auto text-4xl text-stone-400" />
          <p className="mt-3 font-semibold text-stone-800">Транзакций нет</p>
        </div>
      ) : (
        <div className="mt-4">
          <div
            className={`hidden rounded-xl bg-stone-100 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-stone-500 ${COLS}`}
          >
            <span />
            <span>Книга</span>
            <span>Читатель</span>
            <span>Выдана</span>
            <span>Вернуть до</span>
            <span className="text-center">Статус</span>
            <span className="text-right">Действия</span>
          </div>
          <ul className="mt-3 space-y-3">
            {filtered.map((t) => (
              <li
                key={t.id}
                className={`flex flex-col gap-3 rounded-2xl bg-white p-4 ring-1 ring-stone-200 ${COLS}`}
              >
                {t.book.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={t.book.coverUrl}
                    alt={t.book.title}
                    className="h-20 w-14 shrink-0 rounded-md object-cover shadow lg:h-16 lg:w-12"
                  />
                ) : (
                  <div
                    className={`h-20 w-14 shrink-0 rounded-md bg-gradient-to-br ${t.book.gradient} shadow lg:h-16 lg:w-12`}
                  />
                )}

                <div className="min-w-0">
                  <Link
                    href={`/book/${t.book.id}`}
                    className="block truncate font-semibold text-stone-900 hover:text-indigo-600"
                  >
                    {t.book.title}
                  </Link>
                  <p className="truncate text-sm text-stone-500">{t.book.author}</p>
                </div>

                <div className="min-w-0 text-sm">
                  <p className="text-xs text-stone-400 lg:hidden">
                    {t.status === "reserved"
                      ? "Хочет взять"
                      : t.status === "returned"
                        ? "Брал(а)"
                        : "На руках у"}
                  </p>
                  <p className="truncate font-semibold text-stone-800">{t.person}</p>
                  {t.reliability && (
                    <p
                      className={`text-xs ${
                        t.reliability.percent == null
                          ? "text-stone-400"
                          : t.reliability.percent >= 80
                            ? "text-emerald-600"
                            : t.reliability.percent >= 50
                              ? "text-amber-600"
                              : "text-rose-600"
                      }`}
                    >
                      {t.reliability.percent == null
                        ? "Истории возвратов нет"
                        : `Возвращает вовремя: ${t.reliability.percent}% (${t.reliability.onTime}/${t.reliability.total})`}
                    </p>
                  )}
                </div>

                <div className="text-sm">
                  <p className="text-xs text-stone-400 lg:hidden">
                    {t.status === "reserved" ? "Бронь с" : "Выдана"}
                  </p>
                  <p className="font-medium">{formatDate(t.startDate)}</p>
                </div>

                <div className="text-sm">
                  <p className="text-xs text-stone-400 lg:hidden">Вернуть до</p>
                  <p className={`font-medium ${t.status === "overdue" ? "text-rose-600" : ""}`}>
                    {formatDate(t.dueDate)}
                  </p>
                </div>

                <div className="flex lg:justify-center">
                  <span
                    className={`inline-flex h-fit w-full max-w-[7.5rem] items-center justify-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${txStyles[t.status]}`}
                  >
                    {txLabels[t.status]}
                  </span>
                </div>

                <div className="flex flex-wrap gap-2 lg:justify-end">
                  {t.allowedActions.map((a) => (
                    <Button
                      key={a}
                      size="sm"
                      variant={a === "cancel" ? "danger" : a === "extend" ? "outline" : "primary"}
                      onClick={() => act(t, a)}
                    >
                      {ACTION_LABEL[a]}
                    </Button>
                  ))}
                  {t.allowedActions.length === 0 && t.status === "returned" && (
                    <span className="text-sm text-stone-400">Завершено</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
