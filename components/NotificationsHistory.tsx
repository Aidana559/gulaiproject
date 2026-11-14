"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FiBell,
  FiBook,
  FiBookmark,
  FiCheckCircle,
  FiChevronLeft,
  FiChevronRight,
  FiClock,
  FiInfo,
  FiTrash2,
} from "react-icons/fi";
import { useAuth } from "@/components/AuthProvider";
import { fmtDateTime } from "@/lib/moderation-shared";
import { GROUPS, titleOf, type NotifItem } from "@/lib/notification-ui";

const PAGE_SIZE = 10;
const DAYS = 30; // показываем уведомления за последние 30 дней

const ICONS: Record<string, React.ReactNode> = {
  all: <FiBell />,
  moderation: <FiBook />,
  booking: <FiBookmark />,
  return: <FiClock />,
  info: <FiInfo />,
};

type Cat = "all" | (typeof GROUPS)[number]["type"];

/** Все оповещения: и новые, и прочитанные. Прочитанные остаются здесь, пока их не удалят. */
export default function NotificationsHistory() {
  const { user, loading: authLoading } = useAuth();
  const [items, setItems] = useState<NotifItem[] | null>(null);
  const [cat, setCat] = useState<Cat>("all");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications?all=1", { cache: "no-store" });
      const list = res.ok ? (((await res.json()).items ?? []) as NotifItem[]) : [];
      const since = Date.now() - DAYS * 86_400_000;
      setItems(list.filter((n) => new Date(n.createdAt).getTime() >= since));
    } catch {
      setItems([]);
    }
  }, []);

  useEffect(() => {
    if (authLoading || !user) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [authLoading, user, load]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: items?.length ?? 0 };
    for (const n of items ?? []) c[n.type] = (c[n.type] ?? 0) + 1;
    return c;
  }, [items]);

  const inCat = useMemo(() => (items ?? []).filter((n) => cat === "all" || n.type === cat), [items, cat]);
  const pages = Math.max(1, Math.ceil(inCat.length / PAGE_SIZE));
  const cur = Math.min(page, pages);
  const shown = inCat.slice((cur - 1) * PAGE_SIZE, cur * PAGE_SIZE);

  const selIds = inCat.filter((n) => selected.has(n.id)).map((n) => n.id);
  const unreadInCat = inCat.filter((n) => !n.read).length;
  const readInCat = inCat.filter((n) => n.read).length;
  const types = cat === "all" ? undefined : [cat];

  function chooseCat(c: Cat) {
    setCat(c);
    setPage(1);
    setSelected(new Set());
  }

  function toggle(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function call(method: "PATCH" | "DELETE", body: object) {
    setBusy(true);
    await fetch("/api/notifications", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => {});
    setSelected(new Set());
    await load();
    setBusy(false);
  }

  // «Прочитано»: выбранные; если ничего не выбрано — все новые в текущем разделе
  const markDisabled = busy || (selIds.length ? false : unreadInCat === 0);
  const markAction = () => (selIds.length ? call("PATCH", { ids: selIds }) : call("PATCH", { all: true, types }));

  // «Удалить»: выбранные; если ничего не выбрано — все прочитанные в текущем разделе
  const delDisabled = busy || (selIds.length ? false : readInCat === 0);
  function deleteAction() {
    const msg = selIds.length
      ? `Удалить выбранные оповещения (${selIds.length})?`
      : `Удалить все прочитанные оповещения (${readInCat})?`;
    if (!window.confirm(msg)) return;
    void (selIds.length ? call("DELETE", { ids: selIds }) : call("DELETE", { allRead: true, types }));
  }

  if (authLoading || items === null) return <p className="p-16 text-center text-stone-500">Загрузка…</p>;
  if (!user) {
    return (
      <p className="p-16 text-center text-stone-600">
        <Link href="/login" className="text-indigo-600 underline">
          Войдите
        </Link>
        , чтобы увидеть оповещения.
      </p>
    );
  }

  const sideItems: { key: Cat; label: string }[] = [
    { key: "all", label: "Все оповещения" },
    ...GROUPS.map((g) => ({ key: g.type as Cat, label: g.label })),
  ];
  const btn =
    "inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium shadow-sm ring-1 ring-stone-200 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="grid gap-6 md:grid-cols-[17rem_1fr]">
        {/* Левая колонка: разделы со счётчиками */}
        <aside className="h-fit rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-200">
          <h1 className="px-2 pb-3 pt-1 text-sm font-extrabold uppercase tracking-wide text-stone-900">
            Оповещения за {DAYS} дней
          </h1>
          <ul className="divide-y divide-stone-100">
            {sideItems.map((s) => {
              const on = cat === s.key;
              return (
                <li key={s.key}>
                  <button
                    type="button"
                    onClick={() => chooseCat(s.key)}
                    aria-current={on ? "true" : undefined}
                    className={`flex w-full items-center gap-3 px-2 py-3 text-left text-sm hover:text-indigo-700 ${
                      on ? "font-bold text-stone-900" : "text-stone-600"
                    }`}
                  >
                    <span className="text-lg">{ICONS[s.key]}</span>
                    <span className="flex-1">{s.label}</span>
                    <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-bold text-indigo-800">
                      {counts[s.key] ?? 0}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>

        {/* Правая колонка: действия, пагинация, список */}
        <section>
          <div className="flex flex-wrap items-center justify-end gap-3">
            <button type="button" className={`${btn} text-stone-700`} disabled={markDisabled} onClick={markAction}>
              <FiCheckCircle /> Прочитано
            </button>
            <button type="button" className={`${btn} text-rose-600`} disabled={delDisabled} onClick={deleteAction}>
              <FiTrash2 /> Удалить
            </button>
          </div>

          {pages > 1 && (
            <nav className="mt-3 flex items-center justify-end gap-1" aria-label="Страницы">
              <button
                type="button"
                onClick={() => setPage(Math.max(1, cur - 1))}
                disabled={cur === 1}
                aria-label="Назад"
                className="rounded-lg p-2 text-stone-600 hover:bg-white disabled:opacity-30"
              >
                <FiChevronLeft />
              </button>
              {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPage(p)}
                  aria-current={p === cur ? "page" : undefined}
                  className={`min-w-9 rounded-lg px-3 py-1.5 text-sm font-medium ${
                    p === cur ? "bg-white text-stone-900 shadow-sm ring-1 ring-stone-200" : "text-stone-600 hover:bg-white"
                  }`}
                >
                  {p}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setPage(Math.min(pages, cur + 1))}
                disabled={cur === pages}
                aria-label="Вперёд"
                className="rounded-lg p-2 text-stone-600 hover:bg-white disabled:opacity-30"
              >
                <FiChevronRight />
              </button>
            </nav>
          )}

          {shown.length === 0 ? (
            <p className="mt-4 rounded-2xl bg-white p-10 text-center text-stone-500 ring-1 ring-stone-200">
              Оповещений нет.
            </p>
          ) : (
            <ul className="mt-4 space-y-2">
              {shown.map((n) => (
                <li
                  key={n.id}
                  className={`flex items-start gap-3 rounded-xl p-4 ring-1 ring-stone-200 ${
                    n.read ? "bg-white" : "bg-indigo-50/60"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selected.has(n.id)}
                    onChange={() => toggle(n.id)}
                    aria-label="Выбрать оповещение"
                    className="mt-1 h-4 w-4 shrink-0 accent-indigo-600"
                  />
                  <span className="mt-0.5 shrink-0 text-xl text-indigo-700">{ICONS[n.type] ?? <FiInfo />}</span>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-bold text-stone-900">
                      {titleOf(n)}
                      {!n.read && (
                        <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-[11px] font-bold uppercase text-indigo-800">
                          новое
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 break-words text-sm text-stone-700">
                      {n.href ? (
                        <Link
                          href={n.href}
                          onClick={() => !n.read && void call("PATCH", { id: n.id })}
                          className="hover:text-indigo-700 hover:underline"
                        >
                          {n.text}
                        </Link>
                      ) : (
                        n.text
                      )}
                    </p>
                  </div>
                  <p className="shrink-0 text-right text-xs text-stone-400">{fmtDateTime(n.createdAt)}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
