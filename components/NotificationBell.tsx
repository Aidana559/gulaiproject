"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { FiBell } from "react-icons/fi";
import { useAuth } from "@/components/AuthProvider";

type Item = {
  id: string;
  text: string;
  href?: string;
  read: boolean;
  createdAt: string;
};

const POLL_MS = 30_000;

function ago(iso: string) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "только что";
  if (s < 3600) return `${Math.floor(s / 60)} мин назад`;
  if (s < 86400) return `${Math.floor(s / 3600)} ч назад`;
  return new Date(iso).toLocaleDateString("ru-RU");
}

export default function NotificationBell() {
  const { user } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications", { cache: "no-store" });
      if (!res.ok) return;
      const json = await res.json();
      setItems(Array.isArray(json.items) ? json.items : []);
      setUnread(Number(json.unread) || 0);
    } catch {

    }
  }, []);

  useEffect(() => {
    if (!user) return;
    load();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [user, load]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  async function mark(body: { id?: string; all?: boolean }) {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => {});
    await load();
  }

  if (!user) return null;

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          if (!open) load();
        }}
        aria-label={unread ? `Уведомления: ${unread} новых` : "Уведомления"}
        aria-expanded={open}
        className="relative rounded-full p-2 text-stone-600 transition hover:bg-stone-100 hover:text-stone-900"
      >
        <FiBell className="text-xl" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex min-w-[18px] items-center justify-center rounded-full bg-rose-600 px-1 text-[11px] font-bold leading-[18px] text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-stone-200">
          <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3">
            <p className="text-sm font-semibold text-stone-900">Уведомления</p>
            {unread > 0 && (
              <button
                type="button"
                onClick={() => mark({ all: true })}
                className="text-xs font-medium text-indigo-600 hover:underline"
              >
                Прочитать все
              </button>
            )}
          </div>

          {items.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-stone-500">Пока ничего нового</p>
          ) : (
            <ul className="max-h-96 divide-y divide-stone-100 overflow-y-auto">
              {items.map((n) => {
                const body = (
                  <>
                    <p className="text-sm text-stone-800">{n.text}</p>
                    <p className="mt-1 text-xs text-stone-400">{ago(n.createdAt)}</p>
                  </>
                );
                const cls = `block px-4 py-3 hover:bg-stone-50 ${n.read ? "" : "bg-indigo-50/60"}`;
                return (
                  <li key={n.id}>
                    {n.href ? (
                      <Link
                        href={n.href}
                        className={cls}
                        onClick={() => {
                          if (!n.read) mark({ id: n.id });
                          setOpen(false);
                        }}
                      >
                        {body}
                      </Link>
                    ) : (
                      <button
                        type="button"
                        className={`${cls} w-full text-left`}
                        onClick={() => !n.read && mark({ id: n.id })}
                      >
                        {body}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}