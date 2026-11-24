"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { FiBell, FiBook, FiBookmark, FiCheckCircle, FiClock, FiInfo } from "react-icons/fi";
import { useAuth } from "@/components/AuthProvider";
import { GROUPS, fmtShort, titleOf } from "@/lib/notification-ui";
import { loadNotifications, useNotifications } from "@/lib/notificationsStore";

const ICONS: Record<string, React.ReactNode> = {
  moderation: <FiBook />,
  booking: <FiBookmark />,
  return: <FiClock />,
  info: <FiInfo />,
};

export default function NotificationBell() {
  const { user } = useAuth();
  // данные и опрос общие для всех колокольчиков на странице (см. lib/notificationsStore.ts)
  const { items, unread, counts } = useNotifications(user ? String(user.id ?? user.email) : null);
  const [filter, setFilter] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const load = loadNotifications;

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  async function mark(body: { id?: string; all?: boolean; types?: string[] }) {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => {});
    await load(true);
  }

  if (!user) return null;

  const activeFilter = filter && (counts[filter] ?? 0) > 0 ? filter : null;
  const shown = activeFilter ? items.filter((n) => n.type === activeFilter) : items;

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          if (!open) void load();
        }}
        aria-label={unread ? `Оповещения: ${unread} новых` : "Оповещения"}
        title="Оповещения"
        aria-expanded={open}
        className="relative rounded-full p-2 text-stone-600 transition hover:bg-stone-100 hover:text-stone-900"
      >
        <FiBell className="h-5 w-5" aria-hidden />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex min-w-[18px] items-center justify-center rounded-full bg-rose-600 px-1 text-[11px] font-bold leading-[18px] text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-[22rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-stone-200">
          <div className="flex items-center justify-between px-4 pb-2 pt-3">
            <p className="text-base font-bold text-stone-900">Оповещения</p>
            {unread > 0 && (
              <button
                type="button"
                onClick={() => mark({ all: true })}
                className="inline-flex items-center gap-1 text-sm font-medium text-stone-600 hover:text-indigo-700"
              >
                <FiCheckCircle /> Прочитано
              </button>
            )}
          </div>

          {unread === 0 ? (
            <div className="flex flex-col items-center px-4 py-10 text-stone-400">
              <FiBell className="text-6xl" strokeWidth={1.5} />
              <p className="mt-3 text-base text-stone-500">Нет новых оповещений.</p>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap gap-2 px-4 pb-3">
                {GROUPS.filter((g) => (counts[g.type] ?? 0) > 0).map((g) => {
                  const on = activeFilter === g.type;
                  return (
                    <button
                      key={g.type}
                      type="button"
                      onClick={() => setFilter(on ? null : g.type)}
                      aria-pressed={on}
                      title={g.label}
                      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-bold ring-1 ring-inset ${
                        on
                          ? "bg-indigo-600 text-white ring-indigo-600"
                          : "bg-indigo-50 text-indigo-800 ring-indigo-100 hover:bg-indigo-100"
                      }`}
                    >
                      {ICONS[g.type]} {counts[g.type]}
                    </button>
                  );
                })}
              </div>

              <ul className="max-h-96 divide-y divide-stone-100 overflow-y-auto border-t border-stone-100">
                {shown.map((n) => {
                  const body = (
                    <div className="flex gap-3">
                      <span className="mt-0.5 shrink-0 text-xl text-indigo-700">{ICONS[n.type] ?? <FiInfo />}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <p className="text-sm font-bold text-stone-900">{titleOf(n)}</p>
                          <p className="shrink-0 text-xs text-stone-400">{fmtShort(n.createdAt)}</p>
                        </div>
                        <p className="mt-0.5 line-clamp-3 break-words text-sm text-stone-700">{n.text}</p>
                      </div>
                    </div>
                  );
                  const cls = "block w-full px-4 py-3 text-left hover:bg-stone-50";
                  return (
                    <li key={n.id}>
                      {n.href ? (
                        <Link
                          href={n.href}
                          className={cls}
                          onClick={() => {
                            void mark({ id: n.id });
                            setOpen(false);
                          }}
                        >
                          {body}
                        </Link>
                      ) : (
                        <button type="button" className={cls} onClick={() => mark({ id: n.id })}>
                          {body}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </>
          )}

          <Link
            href="/notifications"
            onClick={() => setOpen(false)}
            className="block border-t border-stone-100 px-4 py-3 text-center text-sm font-medium text-stone-600 hover:bg-stone-50 hover:text-indigo-700"
          >
            Все оповещения
          </Link>
        </div>
      )}
    </div>
  );
}
