"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FiArrowLeft, FiArrowRight, FiSearch, FiX } from "react-icons/fi";
import {
  categoryLabels,
  statusLabels,
  type Book,
  type Category,
  type Status,
} from "@/data/books";
import CatalogBookCard from "./CatalogBookCard";
import { Button } from "./Button";

const tabs: { key: Category | "all"; label: string }[] = [
  { key: "all", label: "Все" },
  { key: "book", label: categoryLabels.book },
  { key: "textbook", label: categoryLabels.textbook },
  { key: "guide", label: categoryLabels.guide },
  { key: "manga", label: categoryLabels.manga },
];

/** Вариант фильтра: текст с подчёркиванием у выбранного (как в каталогах с рядами фильтров) */
const optClass = (active: boolean) =>
  `border-b-2 pb-1 text-[15px] transition ${
    active
      ? "border-indigo-600 font-semibold text-stone-900"
      : "border-transparent text-stone-600 hover:text-indigo-700"
  }`;

const STATUS_DOT: Record<Status, string> = {
  available: "bg-emerald-500",
  reserved: "bg-amber-500",
  given: "bg-stone-400",
};

const SORTS: { key: SortKey; label: string }[] = [
  { key: "title", label: "По названию" },
  { key: "new", label: "Новые в каталоге" },
  { key: "popular", label: "Популярные" },
];

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:gap-6">
      <p className="w-24 shrink-0 pt-0.5 text-xs font-semibold uppercase tracking-wide text-stone-400">{label}</p>
      <div className="flex min-w-0 flex-1 flex-wrap gap-x-5 gap-y-2.5">{children}</div>
    </div>
  );
}

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

function plural(n: number, one: string, few: string, many: string) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

export default function CatalogView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const query = searchParams.get("q") ?? "";
  const category = (searchParams.get("category") as Category | "all") || "all";
  // жанров можно выбрать несколько (?genre=A&genre=B): показываются книги со всеми выбранными жанрами
  const selectedGenres = searchParams.getAll("genre").filter((g) => g && g !== "all");
  const genreKey = selectedGenres.join("\u0001");
  const author = searchParams.get("author") ?? "";
  const year = Number(searchParams.get("year")) || 0;
  const status = (searchParams.get("status") as Status | "all") || "all";
  const sort = (searchParams.get("sort") as SortKey) || "title";
  const page = Math.max(1, Number(searchParams.get("page") || 1) || 1);

  const [data, setData] = useState<ApiResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState(query);
  useEffect(() => setQ(query), [query]); // кнопки «Назад/Сбросить» обновляют поле поиска

  const setParams = useCallback(
    (patch: Record<string, string | string[] | null>) => {
      const sp = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(patch)) {
        sp.delete(k);
        if (Array.isArray(v)) v.filter(Boolean).forEach((x) => sp.append(k, x));
        else if (!(v == null || v === "" || v === "all")) sp.set(k, v);
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
    for (const g of genreKey ? genreKey.split("\u0001") : []) sp.append("genre", g);
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
  }, [query, category, genreKey, author, year, status, sort, page]);

  function reset() {
    router.push(pathname);
  }

  const books = data?.books ?? [];
  // жанры берём из реальных книг выбранной категории; выбранный жанр показываем всегда,
  // чтобы его можно было снять
  const genres = Array.from(new Set([...(data?.genres ?? []), ...selectedGenres])).sort((a, b) =>
    a.localeCompare(b, "ru"),
  );
  const toggleGenre = (g: string) =>
    setParams({
      genre: selectedGenres.includes(g) ? selectedGenres.filter((x) => x !== g) : [...selectedGenres, g],
    });
  const total = data?.total ?? 0;
  const pages = data?.pages ?? 1;

  return (
    <div>
      {/* Крупный поиск */}
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          setParams({ q: q.trim() || null });
        }}
        className="flex max-w-3xl items-center gap-2 rounded-full bg-white p-1.5 pl-5 shadow-sm ring-2 ring-stone-900/80 focus-within:ring-indigo-600"
      >
        <FiSearch className="shrink-0 text-lg text-stone-400" />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Название, автор или жанр"
          aria-label="Поиск"
          className="min-w-0 flex-1 bg-transparent py-2.5 text-lg text-stone-900 outline-none placeholder:text-stone-400"
        />
        <button
          type="submit"
          className="rounded-full bg-indigo-600 px-6 py-2.5 font-semibold text-white transition hover:bg-indigo-700"
        >
          Найти
        </button>
      </form>

      {/* Ряды фильтров */}
      <div className="mt-6 space-y-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-stone-200 sm:p-6">
        <FilterRow label="Категория">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              aria-pressed={category === t.key}
              onClick={() => setParams({ category: t.key === "all" ? null : t.key })}
              className={optClass(category === t.key)}
            >
              {t.label}
            </button>
          ))}
        </FilterRow>

        <FilterRow label="Жанр">
          <button
            type="button"
            onClick={() => setParams({ genre: null })}
            aria-pressed={selectedGenres.length === 0}
            className={optClass(selectedGenres.length === 0)}
          >
            Все
          </button>
          {genres.map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => toggleGenre(g)}
              aria-pressed={selectedGenres.includes(g)}
              className={optClass(selectedGenres.includes(g))}
            >
              {g}
            </button>
          ))}
        </FilterRow>

        <FilterRow label="Порядок">
          {SORTS.map((o) => (
            <button
              key={o.key}
              type="button"
              aria-pressed={sort === o.key}
              onClick={() => setParams({ sort: o.key === "title" ? null : o.key })}
              className={optClass(sort === o.key)}
            >
              {o.label}
            </button>
          ))}
        </FilterRow>

        <FilterRow label="Статус">
          <button
            type="button"
            aria-pressed={status === "all"}
            onClick={() => setParams({ status: null })}
            className={optClass(status === "all")}
          >
            Все
          </button>
          {(Object.keys(statusLabels) as Status[]).map((st) => (
            <button
              key={st}
              type="button"
              aria-pressed={status === st}
              onClick={() => setParams({ status: st })}
              className={`${optClass(status === st)} inline-flex items-center gap-2`}
            >
              <span className={`h-2 w-2 rounded-full ${STATUS_DOT[st]}`} aria-hidden />
              {statusLabels[st]}
            </button>
          ))}
        </FilterRow>
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

      <div className="mt-8 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-2xl font-extrabold text-stone-900">
          {loading ? "…" : total.toLocaleString("ru-RU")} {plural(total, "книга", "книги", "книг")} в каталоге
        </h2>
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
        <div className="mt-4 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {books.map((b) => (
            <CatalogBookCard key={b.id} book={b} />
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
