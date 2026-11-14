"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ACTION_LABEL,
  STATE_STYLE,
  actionName,
  actorLabel,
  fmtDate,
  fmtDateTime,
  stateLabel,
  type ModerationAction,
  type ModerationEntry,
} from "@/lib/moderation-shared";

/** Журнал всех действий администрации над книгами: кто, когда, что и почему. */
export default function ModerationLogPanel() {
  const [items, setItems] = useState<ModerationEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [action, setAction] = useState<ModerationAction | "all">("all");
  const [q, setQ] = useState("");

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const sp = new URLSearchParams({ limit: "200" });
        if (action !== "all") sp.set("action", action);
        if (q.trim()) sp.set("q", q.trim());
        const res = await fetch(`/api/moderation-log?${sp}`, { cache: "no-store" });
        const json = res.ok ? await res.json() : { items: [], total: 0 };
        if (!cancelled) {
          setItems(json.items ?? []);
          setTotal(json.total ?? 0);
        }
      } catch {
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [action, q]);

  return (
    <>
      <div className="mt-4 flex flex-wrap gap-2">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Книга, автор, исполнитель, причина"
          aria-label="Поиск по журналу"
          className="mq-input"
          style={{ maxWidth: "22rem" }}
        />
        <select
          value={action}
          onChange={(e) => setAction(e.target.value as ModerationAction | "all")}
          aria-label="Тип действия"
          className="mq-input"
          style={{ maxWidth: "16rem" }}
        >
          <option value="all">Все действия</option>
          {(Object.keys(ACTION_LABEL) as ModerationAction[]).map((a) => (
            <option key={a} value={a}>
              {ACTION_LABEL[a]}
            </option>
          ))}
        </select>
      </div>
      {loaded && <p className="mt-3 text-sm text-stone-500">Записей: {total}</p>}

      <div className="mt-3 overflow-x-auto rounded-2xl bg-white ring-1 ring-stone-200">
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
            {items.map((e) => (
              <tr key={e.id}>
                <td className="whitespace-nowrap p-3 text-stone-600">{fmtDateTime(e.createdAt)}</td>
                <td className="p-3">
                  <Link href={`/book/${e.bookId}/info`} className="font-medium hover:text-indigo-600">
                    {e.bookTitle}
                  </Link>
                  <p className="text-xs text-stone-400">{e.authorName}</p>
                </td>
                <td className="p-3">
                  {actionName(e)}
                  {e.action === "hidden" && e.until && (
                    <p className="text-xs text-stone-500">до {fmtDate(e.until)}</p>
                  )}
                </td>
                <td className="p-3 text-stone-600">{actorLabel(e)}</td>
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
            {loaded && items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-stone-500">
                  Действий пока не было
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
