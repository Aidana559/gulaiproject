"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import ModerationCard from "@/components/ModerationCard";
import { bookState, fmtDateTime, type BookState, type ModerationEntry } from "@/lib/moderation-shared";

type Item = {
  id: string;
  type: string;
  text: string;
  href?: string;
  read: boolean;
  createdAt: string;
  moderation?: ModerationEntry;
};

type Mine = {
  id: string | number;
  deleted?: boolean;
  hidden?: boolean;
  hiddenUntil?: string | null;
  ownerId?: string;
  reviewed?: boolean;
};

type Filter = "all" | "moderation" | "other";

/** Полная история уведомлений: действия администрации над книгами автора и прочие уведомления. */
export default function NotificationsHistory() {
  const { user, loading: authLoading } = useAuth();
  const [items, setItems] = useState<Item[] | null>(null);
  const [current, setCurrent] = useState<Record<string, { state: BookState; until?: string | null }>>({});
  const [filter, setFilter] = useState<Filter>("all");

  const load = useCallback(async () => {
    try {
      const [n, b] = await Promise.all([
        fetch("/api/notifications?all=1", { cache: "no-store" }),
        fetch("/api/books?mine=1&limit=100", { cache: "no-store" }),
      ]);
      if (n.ok) setItems(((await n.json()).items ?? []) as Item[]);
      else setItems([]);
      if (b.ok) {
        // актуальный статус каждой книги автора — для поля «Статус» в карточках
        const list = ((await b.json()).books ?? []) as Mine[];
        const map: Record<string, { state: BookState; until?: string | null }> = {};
        for (const x of list) map[String(x.id)] = { state: bookState(x), until: x.hiddenUntil };
        setCurrent(map);
      }
    } catch {
      setItems([]);
    }
  }, []);

  useEffect(() => {
    if (authLoading || !user) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [authLoading, user, load]);

  async function mark(body: { id?: string; all?: boolean }) {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => {});
    await load();
  }

  if (authLoading || items === null) return <p className="p-16 text-center text-stone-500">Загрузка…</p>;
  if (!user) {
    return (
      <p className="p-16 text-center text-stone-600">
        <Link href="/login" className="text-indigo-600 underline">
          Войдите
        </Link>
        , чтобы увидеть уведомления.
      </p>
    );
  }

  const unread = items.filter((n) => !n.read).length;
  const shown = items.filter((n) =>
    filter === "all" ? true : filter === "moderation" ? n.type === "moderation" : n.type !== "moderation",
  );
  const chip = (on: boolean) =>
    `rounded-full px-3 py-1 text-sm font-medium ring-1 ring-inset ${
      on ? "bg-indigo-600 text-white ring-indigo-600" : "bg-white text-stone-700 ring-stone-300 hover:bg-indigo-50"
    }`;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold text-stone-900 sm:text-3xl">История уведомлений</h1>
        {unread > 0 && (
          <button type="button" onClick={() => mark({ all: true })} className="text-sm font-medium text-indigo-600 hover:underline">
            Прочитать все ({unread})
          </button>
        )}
      </div>
      <p className="mt-2 text-sm text-stone-500">
        Здесь сохраняются все уведомления, включая действия администрации с вашими книгами.
      </p>

      <div className="mt-5 flex flex-wrap gap-2" role="group" aria-label="Фильтр">
        <button type="button" className={chip(filter === "all")} onClick={() => setFilter("all")}>
          Все
        </button>
        <button type="button" className={chip(filter === "moderation")} onClick={() => setFilter("moderation")}>
          О моих книгах
        </button>
        <button type="button" className={chip(filter === "other")} onClick={() => setFilter("other")}>
          Прочие
        </button>
      </div>

      {shown.length === 0 ? (
        <p className="mt-6 rounded-2xl bg-white p-10 text-center text-stone-500 ring-1 ring-stone-200">
          Уведомлений нет.
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          {shown.map((n) => (
            <li key={n.id} onClick={() => !n.read && mark({ id: n.id })}>
              {n.moderation ? (
                <ModerationCard entry={n.moderation} unread={!n.read} currentState={current[n.moderation.bookId]} />
              ) : (
                <div className={`rounded-2xl p-4 ring-1 ring-stone-200 ${n.read ? "bg-white" : "bg-indigo-50/60"}`}>
                  <p className="text-sm text-stone-800">
                    {n.href ? (
                      <Link href={n.href} className="hover:text-indigo-700 hover:underline">
                        {n.text}
                      </Link>
                    ) : (
                      n.text
                    )}
                  </p>
                  <p className="mt-1 text-xs text-stone-400">{fmtDateTime(n.createdAt)}</p>
                </div>
              )}
              {n.moderation && (
                <p className="mt-1 px-1 text-xs text-stone-400">Получено: {fmtDateTime(n.createdAt)}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
