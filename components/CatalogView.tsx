"use client";

import { useMemo, useState } from "react";
import { books, categoryLabels, genres, statusLabels, type Category, type Status } from "@/data/books";
import BookCard from "./BookCard";
import { Button } from "./Button";
import { inputClass } from "./FormField";
import { bookState, useTransactions } from "@/lib/txStore";

const tabs: { key: Category | "all"; label: string; emoji: string }[] = [
  { key: "all", label: "Все", emoji: "🗂️" },
  { key: "book", label: categoryLabels.book, emoji: "📖" },
  { key: "textbook", label: categoryLabels.textbook, emoji: "🎓" },
  { key: "guide", label: categoryLabels.guide, emoji: "📝" },
  { key: "manga", label: categoryLabels.manga, emoji: "🈸" },
];

export default function CatalogView({ initialCategory = "all" }: { initialCategory?: Category | "all" }) {
  const txs = useTransactions();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Category | "all">(initialCategory);
  const [genre, setGenre] = useState("all");
  const [status, setStatus] = useState<Status | "all">("all");
  const [sort, setSort] = useState<"title" | "year">("title");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return books
      .filter((b) => category === "all" || b.category === category)
      .filter((b) => genre === "all" || b.genre === genre)
      .filter((b) => status === "all" || bookState(b, txs).status === status)
      .filter((b) => !q || b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q))
      .sort((a, b) => (sort === "title" ? a.title.localeCompare(b.title, "ru") : b.year - a.year));
  }, [query, category, genre, status, sort, txs]);

  function reset() {
    setQuery("");
    setCategory("all");
    setGenre("all");
    setStatus("all");
    setSort("title");
  }

  return (
    <div>
      {/* Категории */}
      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <Button
            key={t.key}
            size="sm"
            variant={category === t.key ? "primary" : "outline"}
            onClick={() => setCategory(t.key)}
          >
            <span>{t.emoji}</span> {t.label}
          </Button>
        ))}
      </div>

      {/* Фильтры */}
      <div className="mt-5 grid gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-200 sm:grid-cols-2 lg:grid-cols-5">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Поиск по названию или автору"
          aria-label="Поиск"
          className={`${inputClass} lg:col-span-2`}
        />
        <select value={genre} onChange={(e) => setGenre(e.target.value)} aria-label="Жанр" className={inputClass}>
          <option value="all">Все жанры</option>
          {genres.map((g) => (
            <option key={g} value={g}>{g}</option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as Status | "all")}
          aria-label="Статус"
          className={inputClass}
        >
          <option value="all">Любой статус</option>
          {(Object.keys(statusLabels) as Status[]).map((s) => (
            <option key={s} value={s}>{statusLabels[s]}</option>
          ))}
        </select>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as "title" | "year")}
          aria-label="Сортировка"
          className={inputClass}
        >
          <option value="title">По названию</option>
          <option value="year">Сначала новые</option>
        </select>
      </div>

      <div className="mt-6 flex items-center justify-between">
        <p className="text-sm text-stone-500">Найдено: <b className="text-stone-800">{filtered.length}</b></p>
        <Button variant="ghost" size="sm" onClick={reset}>Сбросить фильтры</Button>
      </div>

      {filtered.length === 0 ? (
        <div className="mt-10 rounded-2xl bg-white p-12 text-center ring-1 ring-stone-200">
          <p className="text-4xl">🔍</p>
          <p className="mt-3 font-semibold text-stone-800">Ничего не найдено</p>
          <p className="mt-1 text-sm text-stone-500">Попробуйте изменить запрос или фильтры.</p>
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((b) => (
            <BookCard key={b.id} book={b} />
          ))}
        </div>
      )}
    </div>
  );
}