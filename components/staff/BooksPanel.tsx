"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useToast } from "./useToast";

type BookRow = {
  id: number | string;
  title: string;
  author: string;
  hidden?: boolean;
};

/** Все объявления (включая скрытые): скрыть, показать, изменить, удалить. */
export default function BooksPanel() {
  const [books, setBooks] = useState<BookRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const { toast, toastNode } = useToast();

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/books?all=1&limit=50&sort=new", { cache: "no-store" });
      const json = res.ok ? await res.json() : [];
      setBooks(Array.isArray(json) ? json : Array.isArray(json?.books) ? json.books : []);
    } catch {
      setBooks([]);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function hide(id: string | number, hidden: boolean) {
    const res = await fetch(`/api/books/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hidden }),
    }).catch(() => null);
    toast(res?.ok ? (hidden ? "Объявление скрыто" : "Объявление показано") : "Ошибка");
    await load();
  }

  async function remove(id: string | number) {
    if (!confirm("Удалить объявление?")) return;
    const res = await fetch(`/api/books/${id}`, { method: "DELETE" }).catch(() => null);
    toast(res?.ok ? "Объявление удалено" : "Ошибка");
    await load();
  }

  return (
    <>
      <div className="mt-6 overflow-x-auto rounded-2xl bg-white ring-1 ring-stone-200">
        <table className="w-full min-w-[480px] text-left text-sm">
          <thead className="border-b bg-stone-50 text-xs uppercase text-stone-500">
            <tr>
              <th className="p-3">Название</th>
              <th className="p-3">Автор</th>
              <th className="p-3">Статус</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {books.map((b) => (
              <tr key={b.id}>
                <td className="p-3">
                  <Link href={`/book/${b.id}`} className="font-medium hover:text-indigo-600">
                    {b.title}
                  </Link>
                </td>
                <td className="p-3 text-stone-600">{b.author}</td>
                <td className="p-3">{b.hidden ? "Скрыто" : "Опубликовано"}</td>
                <td className="flex flex-wrap gap-2 p-3">
                  <Link href={`/book/${b.id}/edit`} className="rounded border px-2 py-1 text-xs">
                    Изменить
                  </Link>
                  <button
                    type="button"
                    onClick={() => hide(b.id, !b.hidden)}
                    className="rounded border px-2 py-1 text-xs"
                  >
                    {b.hidden ? "Показать" : "Скрыть"}
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(b.id)}
                    className="rounded border px-2 py-1 text-xs text-red-600"
                  >
                    Удалить
                  </button>
                </td>
              </tr>
            ))}
            {loaded && books.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-stone-500">
                  Объявлений нет
                </td>
              </tr>
            )}
            {!loaded && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-stone-500">
                  Загрузка…
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {toastNode}
    </>
  );
}
