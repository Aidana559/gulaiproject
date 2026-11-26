"use client";

import UserLink from "@/components/UserLink";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ACTION_LABEL,
  APP_TZ,
  STATE_STYLE,
  actionName,
  actorLabel,
  fmtDate,
  fmtDateTime,
  stateLabel,
  type ModerationAction,
  type ModerationEntry,
} from "@/lib/moderation-shared";

type Sort = "new" | "old";

const norm = (v: unknown) => String(v ?? "").toLowerCase().replace(/ё/g, "е").replace(/\s+/g, " ").trim();
const dayFmt = new Intl.DateTimeFormat("en-CA", { timeZone: APP_TZ, year: "numeric", month: "2-digit", day: "2-digit" });

const dayOf = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : dayFmt.format(d);
};


export default function ModerationLogPanel() {
  const [items, setItems] = useState<ModerationEntry[]>([]);
  const [emails, setEmails] = useState<Record<string, string>>({});
  const [loaded, setLoaded] = useState(false);
  const [action, setAction] = useState<ModerationAction | "all">("all");
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sort, setSort] = useState<Sort>("new");

  
  
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/moderation-log?limit=500", { cache: "no-store" });
        const json = res.ok ? await res.json() : { items: [] };
        if (!cancelled) setItems(Array.isArray(json.items) ? json.items : []);
      } catch {
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoaded(true);
      }
      
      try {
        const res = await fetch("/api/admin/users", { cache: "no-store" });
        if (!res.ok) return;
        const json = await res.json();
        const map: Record<string, string> = {};
        for (const u of json.users ?? []) if (u?.id && u?.email) map[String(u.id)] = String(u.email);
        if (!cancelled) setEmails(map);
      } catch {
        /* поиск по email просто не найдёт ничего лишнего */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const searched = useMemo(() => {
    const query = norm(q);
    const [lo, hi] = from && to && from > to ? [to, from] : [from, to];
    return items.filter((e) => {
      
      if (
        query &&
        ![e.actorName, e.authorName, e.actorId ? emails[e.actorId] : "", e.authorId ? emails[e.authorId] : "", e.bookTitle, e.reason].some((v) =>
          norm(v).includes(query),
        )
      )
        return false;
      if (lo || hi) {
        const d = dayOf(e.createdAt);
        if (!d || (lo && d < lo) || (hi && d > hi)) return false;
      }
      return true;
    });
  }, [items, q, from, to, emails]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const e of searched) c[e.action] = (c[e.action] ?? 0) + 1;
    return c;
  }, [searched]);

  const rows = useMemo(() => {
    const list = action === "all" ? searched : searched.filter((e) => e.action === action);
    const t = (e: ModerationEntry) => new Date(e.createdAt).getTime() || 0;
    return [...list].sort((a, b) => (sort === "new" ? t(b) - t(a) : t(a) - t(b)));
  }, [searched, action, sort]);

  const isDefault = action === "all" && q === "" && from === "" && to === "" && sort === "new";
  const resetFilters = () => {
    setAction("all");
    setQ("");
    setFrom("");
    setTo("");
    setSort("new");
  };

  const field =
    "w-full rounded-full bg-white px-4 py-2.5 text-sm text-stone-900 ring-1 ring-inset ring-stone-300 placeholder:text-stone-400 focus:outline focus:outline-2 focus:outline-indigo-600";

  return (
    <>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2 lg:col-span-4">
          <label htmlFor="log-search" className="sr-only">
            Поиск по журналу
          </label>
          <input
            id="log-search"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Поиск: имя или email пользователя, книга, причина"
            autoComplete="off"
            className={field}
          />
        </div>
        <div>
          <label htmlFor="log-action" className="sr-only">
            Тип действия
          </label>
          <select id="log-action" value={action} onChange={(e) => setAction(e.target.value as ModerationAction | "all")} className={field}>
            <option value="all">Все действия ({searched.length})</option>
            {(Object.keys(ACTION_LABEL) as ModerationAction[]).map((a) => (
              <option key={a} value={a}>
                {ACTION_LABEL[a]} ({counts[a] ?? 0})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="log-sort" className="sr-only">
            Сортировка
          </label>
          <select id="log-sort" value={sort} onChange={(e) => setSort(e.target.value as Sort)} className={field}>
            <option value="new">Сначала новые</option>
            <option value="old">Сначала старые</option>
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm text-stone-600">
          <span className="w-4 shrink-0">с</span>
          <input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} aria-label="Дата с" className={field} />
        </label>
        <label className="flex items-center gap-2 text-sm text-stone-600">
          <span className="w-4 shrink-0">по</span>
          <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} aria-label="Дата по" className={field} />
        </label>
        <div className="sm:col-span-2 lg:col-span-4">
          <button
            type="button"
            onClick={resetFilters}
            disabled={isDefault}
            className="rounded-full bg-white px-4 py-2.5 text-sm font-medium text-stone-700 ring-1 ring-inset ring-stone-300 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Сбросить фильтры
          </button>
        </div>
      </div>

      <p className="mt-3 min-h-5 text-sm text-stone-500" role="status" aria-live="polite">
        {loaded ? (
          <>
            Найдено: <span className="font-semibold text-stone-700">{rows.length}</span>
            {rows.length !== items.length && <> из {items.length}</>}
          </>
        ) : null}
      </p>

      <div className="mt-2 min-h-[22rem] overflow-x-auto rounded-2xl bg-white ring-1 ring-stone-200 [overflow-anchor:none]">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b bg-stone-50 text-xs uppercase text-stone-500">
            <tr>
              <th className="p-3">Дата и время</th>
              <th className="p-3">Книга / автор</th>
              <th className="p-3">Действие</th>
              <th className="p-3">Выполнил</th>
              <th className="p-3">Причина</th>
              <th className="p-3">Статус после</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((e) => (
              <tr key={e.id}>
                <td className="whitespace-nowrap p-3 text-stone-600">{fmtDateTime(e.createdAt)}</td>
                <td className="p-3">
                  <Link href={`/book/${e.bookId}/info`} className="font-medium hover:text-indigo-600">
                    {e.bookTitle}
                  </Link>
                  <p className="text-xs text-stone-400"><UserLink userId={e.authorId}>{e.authorName}</UserLink></p>
                </td>
                <td className="p-3">
                  {actionName(e)}
                  {e.action === "hidden" && e.until && (
                    <p className="text-xs text-stone-500">до {fmtDate(e.until)}</p>
                  )}
                </td>
                <td className="p-3 text-stone-600"><UserLink userId={e.actorId}>{actorLabel(e)}</UserLink></td>
                <td className="p-3 text-stone-600">{e.reason ?? "—"}</td>
                <td className="p-3">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${STATE_STYLE[e.stateAfter]}`}
                  >
                    {stateLabel(e.stateAfter, e.until)}
                  </span>
                </td>
              </tr>
            ))}
            {loaded && rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-stone-500">
                  {items.length === 0 ? (
                    "Действий пока не было"
                  ) : (
                    <>
                      По вашему запросу ничего не найдено.{" "}
                      <button type="button" onClick={resetFilters} className="font-medium text-indigo-700 underline">
                        Сбросить фильтры
                      </button>
                    </>
                  )}
                </td>
              </tr>
            )}
            {!loaded && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-stone-500">
                  Загрузка…
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
