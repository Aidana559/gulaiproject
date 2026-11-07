"use client";

import { useEffect, useRef, useState } from "react";
import { inputClass } from "./FormField";

export type GoogleBookHit = {
  id: string;
  title: string;
  author: string;
  year?: number;
  pages?: number;
  description: string;
  category: string;
  cover: string;
};

export default function GoogleBookSearch({ onPick }: { onPick: (b: GoogleBookHit) => void }) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<GoogleBookHit[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const query = q.trim();
    if (query.length < 2) {
      setItems([]);
      setMsg("");
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setBusy(true);
      try {
        const res = await fetch(`/api/google-books?q=${encodeURIComponent(query)}`, {
          signal: ctrl.signal,
        });
        const json = await res.json().catch(() => ({}));
        setItems(Array.isArray(json.items) ? json.items : []);
        setMsg(!res.ok ? (json.error ?? "Ошибка поиска") : json.items?.length ? "" : "Ничего не найдено");
        setOpen(true);
      } catch {

      } finally {
        setBusy(false);
      }
    }, 400);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div ref={boxRef} className="relative">
      <label htmlFor="gb-search" className="mb-1.5 block text-sm font-medium text-stone-700">
        Найти книгу
      </label>
      <input
        id="gb-search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => items.length > 0 && setOpen(true)}
        placeholder="Название или автор — например, 1984 Оруэлл"
        autoComplete="off"
        className={inputClass}
      />
      <p className="mt-1 text-xs text-stone-400">
        Выберите вариант — название, автор, год, описание и обложка заполнятся сами.
        {busy && " Ищем…"}
      </p>

      {open && (items.length > 0 || msg) && (
        <ul className="absolute z-20 mt-1 max-h-80 w-full overflow-y-auto rounded-xl bg-white shadow-lg ring-1 ring-stone-200">
          {msg && <li className="px-4 py-3 text-sm text-stone-500">{msg}</li>}
          {items.map((b) => (
            <li key={b.id}>
              <button
                type="button"
                onClick={() => {
                  onPick(b);
                  setQ("");
                  setItems([]);
                  setOpen(false);
                }}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-indigo-50"
              >
                {b.cover ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={b.cover} alt="" className="h-14 w-10 shrink-0 rounded object-cover" />
                ) : (
                  <span className="h-14 w-10 shrink-0 rounded bg-stone-100" />
                )}
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-stone-900">
                    {b.title}
                  </span>
                  <span className="block truncate text-xs text-stone-500">
                    {b.author || "автор не указан"}
                    {b.year ? ` · ${b.year}` : ""}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}