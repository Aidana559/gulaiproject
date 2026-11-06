"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  categoryLabels,
  genres,
  statusLabels,
  type Book,
  type Category,
  type Status,
} from "@/data/books";
import BookCard from "./BookCard";
import { Button } from "./Button";
import { inputClass } from "./FormField";

const tabs: { key: Category | "all"; label: string; emoji: string }[] = [
  { key: "all", label: "Все", emoji: "🗂️" },
  { key: "book", label: categoryLabels.book, emoji: "📖" },
  { key: "textbook", label: categoryLabels.textbook, emoji: "🎓" },
  { key: "guide", label: categoryLabels.guide, emoji: "📝" },
  { key: "manga", label: categoryLabels.manga, emoji: "🈸" },
];

type SortKey = "title" | "new" | "popular";

type ApiResult = {
  books: Book[];
  total: number;
  page: number;
  limit: number;
  pages: number;
};

export default function CatalogView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const query = searchParams.get("q") ?? "";
  const category = (searchParams.get("category") as Category | "all") || "all";
  const genre = searchParams.get("genre") ?? "all";
  const status = (searchParams.get("status") as Status | "all") || "all";
  const sort = (searchParams.get("sort") as SortKey) || "title";
  const page = Math.max(1, Number(searchParams.get("page") || 1) || 1);

  const [data, setData] = useState<ApiResult | null>(null);
  const [loading, setLoading] = useState(true);

  const setParams = useCallback(
    (patch: Record<string, string | null>) => {
      const sp = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v == null || v === "" || v === "all") sp.delete(k);
        else sp.set(k, v);
      }
      if (!("page" in patch)) sp.delete("page"); // сброс страницы при смене фильтра
      const qs = sp.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname);
    },
    [router, pathname, searchParams],
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const sp = new URLSearchParams();
    if (query) sp.set("q", query);
    if (category !== "all") sp.set("category", category);
    if (genre !== "all") sp.set("genre", genre);
    if (status !== "all") sp.set("status", status);
    if (sort && sort !== "title") sp.set("sort", sort);
    sp.set("page", String(page));
    sp.set("limit", "24");

    fetch(`/api/books?${sp}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((json: ApiResult) => {
        if (!cancelled) setData(json);
      })
      .catch(() => {
        if (!cancelled) setData({ books: [], total: 0, page: 1, limit: 24, pages: 1 });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [query, category, genre, status, sort, page]);

  function reset() {
    router.push(pathname);
  }

  const books = data?.books ?? [];
  const total = data?.total ?? 0;
  const pages = data?.pages ?? 1;

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <Button
            key={t.key}
            size="sm"
            variant={category === t.key ? "primary" : "outline"}
            onClick={() => setParams({ category: t.key === "all" ? null : t.key })}
          >
            <span>{t.emoji}</span> {t.label}
          </Button>
        ))}
      </div>

      <div className="mt-5 grid gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-200 sm:grid-cols-2 lg:grid-cols-5">
        <input
          type="search"
          defaultValue={query}
          key={query}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              setParams({ q: (e.target as HTMLInputElement).value || null });
            }
          }}
          onBlur={(e) => setParams({ q: e.target.value || null })}
          placeholder="Поиск по названию или автору"
          aria-label="Поиск"
          className={`${inputClass} lg:col-span-2`}
        />
        <select
          value={genre}
          onChange={(e) => setParams({ genre: e.target.value })}
          aria-label="Жанр"
          className={inputClass}
        >
          <option value="all">Все жанры</option>
          {genres.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => setParams({ status: e.target.value })}
          aria-label="Статус"
          className={inputClass}
        >
          <option value="all">Любой статус</option>
          {(Object.keys(statusLabels) as Status[]).map((s) => (
            <option key={s} value={s}>
              {statusLabels[s]}
            </option>
          ))}
        </select>
        <select
          value={sort}
          onChange={(e) => setParams({ sort: e.target.value })}
          aria-label="Сортировка"
          className={inputClass}
        >
          <option value="title">По названию</option>
          <option value="new">Сначала новые</option>
          <option value="popular">Популярные</option>
        </select>
      </div>

      <div className="mt-6 flex items-center justify-between">
        <p className="text-sm text-stone-500">
          Найдено: <b className="text-stone-800">{loading ? "…" : total}</b>
        </p>
        <Button variant="ghost" size="sm" onClick={reset}>
          Сбросить фильтры
        </Button>
      </div>

      {loading ? (
        <p className="mt-10 text-center text-stone-500">Загрузка…</p>
      ) : books.length === 0 ? (
        <div className="mt-10 rounded-2xl bg-white p-12 text-center ring-1 ring-stone-200">
          <p className="text-4xl">🔍</p>
          <p className="mt-3 font-semibold text-stone-800">Ничего не найдено</p>
          <p className="mt-1 text-sm text-stone-500">Попробуйте изменить запрос или фильтры.</p>
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {books.map((b) => (
            <BookCard key={b.id} book={b} />
          ))}
        </div>
      )}

      {pages > 1 && (
        <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={page <= 1}
            onClick={() => setParams({ page: String(page - 1) })}
          >
            ← Назад
          </Button>
          <span className="text-sm text-stone-600">
            {page} / {pages}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={page >= pages}
            onClick={() => setParams({ page: String(page + 1) })}
          >
            Вперёд →
          </Button>
        </div>
      )}
    </div>
  );
}
