"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { FiBookOpen, FiChevronRight } from "react-icons/fi";
import { statusLabels, statusStyles, type Book } from "@/data/books";
import CategoryIcon from "./CategoryIcon";

type Item = Pick<
  Book,
  "id" | "title" | "author" | "category" | "status" | "year" | "gradient" | "coverUrl"
>;

const REFRESH_MS = 30_000;

/**
 * Правая колонка: другие книги этого автора.
 * Список берётся из /api/books (no-store) и обновляется сам: при открытии,
 * при возврате на вкладку и раз в 30 секунд — новая книга автора, добавленная
 * кем угодно, появляется здесь без перезагрузки страницы.
 */
export default function AuthorBooks({
  author,
  currentId,
}: {
  author: string;
  currentId: string | number;
}) {
  const [items, setItems] = useState<Item[] | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/books?author=${encodeURIComponent(author)}&limit=100&sort=new`,
        { cache: "no-store" },
      );
      if (!res.ok) throw new Error();
      const json = (await res.json()) as { books?: Item[] };
      setItems((json.books ?? []).filter((b) => String(b.id) !== String(currentId)));
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [author, currentId]);

  useEffect(() => {
    load();
    const onVisible = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", load);
    const timer = window.setInterval(onVisible, REFRESH_MS);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", load);
      window.clearInterval(timer);
    };
  }, [load]);

  return (
    <aside
      aria-label="Другие книги автора"
      className="flex h-[26rem] min-w-0 flex-col overflow-hidden rounded-2xl bg-white ring-1 ring-stone-200 lg:h-[36rem]"
    >
      <div className="shrink-0 border-b border-stone-200 px-5 py-4">
        <h2 className="text-lg font-bold text-stone-900">Другие книги автора</h2>
        <p className="mt-0.5 truncate text-sm text-stone-500">{author}</p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
        {items === null && !failed && (
          <ul className="space-y-1" aria-hidden>
            {[0, 1, 2, 3].map((i) => (
              <li key={i} className="flex animate-pulse gap-3 p-3">
                <div className="h-16 w-12 rounded bg-stone-100" />
                <div className="flex-1 space-y-2 pt-1">
                  <div className="h-3 w-4/5 rounded bg-stone-100" />
                  <div className="h-3 w-1/3 rounded bg-stone-100" />
                </div>
              </li>
            ))}
          </ul>
        )}

        {items === null && failed && (
          <p className="p-4 text-sm text-stone-500">Не удалось загрузить список.</p>
        )}

        {items !== null && items.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-sm text-stone-500">
            <FiBookOpen className="text-2xl text-stone-300" />
            Других книг этого автора пока нет.
          </div>
        )}

        {items !== null && items.length > 0 && (
          <ul className="space-y-1">
            {items.map((b) => (
              <li key={b.id}>
                <Link
                  href={`/book/${b.id}`}
                  className="group flex items-center gap-3 rounded-xl p-3 transition hover:bg-stone-50"
                >
                  {b.coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={b.coverUrl}
                      alt=""
                      loading="lazy"
                      className="h-16 w-12 shrink-0 rounded object-cover shadow-sm ring-1 ring-black/5"
                    />
                  ) : (
                    <span
                      className={`flex h-16 w-12 shrink-0 items-center justify-center rounded bg-gradient-to-br ${b.gradient} text-white shadow-sm`}
                    >
                      <CategoryIcon category={b.category} className="text-lg" />
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 font-semibold leading-snug text-stone-900 group-hover:text-indigo-700">
                      {b.title}
                    </span>
                    <span className="mt-1 flex items-center gap-2 text-xs text-stone-500">
                      {b.year ? <span>{b.year}</span> : null}
                      <span
                        className={`rounded-full px-2 py-0.5 font-medium ring-1 ring-inset ${statusStyles[b.status]}`}
                      >
                        {statusLabels[b.status]}
                      </span>
                    </span>
                  </span>
                  <FiChevronRight className="shrink-0 text-stone-300 group-hover:text-indigo-500" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="shrink-0 border-t border-stone-200 px-5 py-3">
        <Link
          href={`/author/${encodeURIComponent(author)}`}
          className="text-sm font-medium text-indigo-700 hover:underline"
        >
          Все книги автора →
        </Link>
      </div>
    </aside>
  );
}
