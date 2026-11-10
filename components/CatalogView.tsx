"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FiArrowLeft, FiArrowRight, FiGrid, FiSearch, FiX } from "react-icons/fi";
import CategoryIcon from "./CategoryIcon";
import {
  categoryLabels,
  statusLabels,
  type Book,
  type Category,
  type Status,
} from "@/data/books";
import BookCard from "./BookCard";
import { Button } from "./Button";
import { inputClass } from "./FormField";

const tabs: { key: Category | "all"; label: string }[] = [
  { key: "all", label: "Все" },
  { key: "book", label: categoryLabels.book },
  { key: "textbook", label: categoryLabels.textbook },
  { key: "guide", label: categoryLabels.guide },
  { key: "manga", label: categoryLabels.manga },
];

const chipClass = (active: boolean) =>
  `rounded-full px-3 py-1 text-sm font-medium ring-1 ring-inset transition ${
    active
      ? "bg-indigo-600 text-white ring-indigo-600"
      : "bg-white text-stone-700 ring-stone-300 hover:bg-indigo-50 hover:text-indigo-700"
  }`;

const activeChip =
  "inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1 font-medium text-indigo-700 ring-1 ring-inset ring-indigo-200 hover:bg-indigo-100";

type SortKey = "title" | "new" | "popular";

type ApiResult = {
  books: Book[];
  genres?: string[];
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
  const author = searchParams.get("author") ?? "";
  const year = Number(searchParams.get("year")) || 0;
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
    if (author) sp.set("author", author);
    if (year) sp.set("year", String(year));
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
        if (!cancelled) setData({ books: [], genres: [], total: 0, page: 1, limit: 24, pages: 1 });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [query, category, genre, author, year, status, sort, page]);

  function reset() {
    router.push(pathname);
  }

  const books = data?.books ?? [];
  // жанры берём из реальных книг выбранной категории; выбранный жанр показываем всегда,
  // чтобы его можно было снять
  const genres = Array.from(new Set([...(data?.genres ?? []), ...(genre !== "all" ? [genre] : [])])).sort(
    (a, b) => a.localeCompare(b, "ru"),
  );
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
            {t.key === "all" ? <FiGrid /> : <CategoryIcon category={t.key} />} {t.label}
          </Button>
        ))}
      </div>

      <div className="mt-5 grid gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-200 sm:grid-cols-2 lg:grid-cols-4">
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

      <div className="mt-4" role="group" aria-label="Жанр">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-stone-400">Жанр</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setParams({ genre: null })}
            aria-pressed={genre === "all"}
            className={chipClass(genre === "all")}
          >
            Все жанры
          </button>
          {genres.map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setParams({ genre: genre === g ? null : g })}
              aria-pressed={genre === g}
              className={chipClass(genre === g)}
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      {(author || year > 0) && (
        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-stone-500">Фильтры:</span>
          {author && (
            <button type="button" onClick={() => setParams({ author: null })} className={activeChip}>
              Автор: {author} <FiX />
            </button>
          )}
          {year > 0 && (
            <button type="button" onClick={() => setParams({ year: null })} className={activeChip}>
              Год: {year} <FiX />
            </button>
          )}
        </div>
      )}

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
          <FiSearch className="mx-auto text-4xl text-stone-400" />
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
            <FiArrowLeft /> Назад
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
            Вперёд <FiArrowRight />
          </Button>
        </div>
      )}
    </div>
  );
}
