"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { LinkButton } from "./Button";
import BookCover from "./BookCover";
import type { Book } from "@/data/books";
import { categoryLabels } from "@/data/books";
import { genresOf } from "@/lib/genres";
import {
  LISTING_FILTERS,
  canManageOwnListings,
  matchesListingFilter,
  type ListingFilter,
} from "@/lib/listing-access";
import { STATE_STYLE, bookState, fmtDate } from "@/lib/moderation-shared";
import { useTaxonomy } from "@/components/TaxonomyProvider";
import { FiEdit2, FiTrash2 } from "react-icons/fi";
import { ICON_SIZE_SM } from "@/components/CategoryIcon";

type Listing = Book & {
  ownerId?: string;
  owner?: string;
  views?: number;
  createdAt?: string;
  hidden?: boolean;
  hiddenUntil?: string | null;
  hiddenReason?: string;
  ownerHidden?: boolean;
  deleted?: boolean;
  deletedReason?: string;
  reviewed?: boolean;
};

async function request(url: string, init: RequestInit): Promise<string | null> {
  try {
    const res = await fetch(url, init);
    if (res.ok) return null;
    const json = await res.json().catch(() => ({}));
    return json.error ?? "Не удалось выполнить действие";
  } catch {
    return "Нет связи с сервером";
  }
}

export default function MyListings() {
  useTaxonomy(); 
  const { user } = useAuth();
  const [items, setItems] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ListingFilter>("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const allowed = !!user && canManageOwnListings(user.role);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/books?mine=1&limit=100&sort=new", { cache: "no-store" });
      const json = await res.json();
      setItems(Array.isArray(json.books) ? json.books : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!allowed) return;
    void load();
  }, [allowed, load]);

  const shown = useMemo(() => items.filter((b) => matchesListingFilter(b, filter)), [items, filter]);
  const counts = useMemo(
    () => Object.fromEntries(LISTING_FILTERS.map((f) => [f.key, items.filter((b) => matchesListingFilter(b, f.key)).length])),
    [items],
  );

  async function act(id: number | string, run: () => Promise<string | null>, okMessage?: string) {
    setBusyId(String(id));
    setError("");
    setSuccess("");
    const err = await run();
    if (err) setError(err);
    else if (okMessage) setSuccess(okMessage);
    // обновляем список без перезагрузки страницы
    await load();
    setBusyId(null);
  }

  const setHidden = (b: Listing, hidden: boolean) =>
    act(
      b.id,
      () =>
        request(`/api/books/${b.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ownerHidden: hidden }),
        }),
      hidden ? "Объявление скрыто из каталога" : "Объявление снова опубликовано",
    );

  function remove(b: Listing) {
    if (
      !confirm(
        `Удалить объявление «${b.title}»?\n\nОтзывы и жалобы по этой книге будут удалены. ` +
          "История бронирований и переписки сохранится. Действие нельзя отменить самостоятельно.",
      )
    )
      return;
    void act(b.id, () => request(`/api/books/${b.id}`, { method: "DELETE" }), "Объявление удалено");
  }

  if (!allowed) return null;

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-900">Мои объявления</h2>
        <LinkButton href="/add" size="sm">
          Добавить
        </LinkButton>
      </div>

      {/* Фильтры по статусу */}
      <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Фильтр объявлений">
        {LISTING_FILTERS.map((f) => {
          const on = filter === f.key;
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              aria-pressed={on}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                on ? "bg-indigo-700 text-white" : "bg-stone-100 text-stone-700 hover:bg-stone-200"
              }`}
            >
              {f.label}
              <span className={`ml-1.5 text-xs ${on ? "text-indigo-200" : "text-stone-400"}`}>{counts[f.key]}</span>
            </button>
          );
        })}
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      {success && (
        <p role="status" className="mt-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {success}
        </p>
      )}

      {loading ? (
        <p className="mt-4 text-sm text-slate-500">Загрузка…</p>
      ) : items.length === 0 ? (
        <p className="mt-4 text-sm text-slate-600">Пока нет объявлений.</p>
      ) : shown.length === 0 ? (
        <p className="mt-4 text-sm text-slate-600">В этой категории объявлений нет.</p>
      ) : (
        <ul className="mt-4 divide-y divide-slate-100 [overflow-anchor:none]">
          {shown.map((b) => {
            const state = bookState(b); // статус модерации: published | pending | hidden (отклонено) | deleted
            const ownerHidden = !!b.ownerHidden && state !== "deleted"; // видимость — отдельно
            const genres = genresOf(b);
            const busy = busyId === String(b.id);
            const modLabel =
              state === "hidden"
                ? "Отклонено"
                : state === "pending"
                  ? "На модерации"
                  : state === "deleted"
                    ? "Удалена"
                    : ownerHidden
                      ? "Одобрено"
                      : "Опубликована";
            return (
              <li
                key={b.id}
                className="relative flex min-w-0 items-start gap-3 py-4 sm:gap-4"
              >
                <div className="flex min-w-0 flex-1 items-start gap-3 sm:gap-4">
                  {/* Обложка: фото или градиент-заглушка (BookCover сам выбирает) */}
                  <div className="w-14 shrink-0 sm:w-16">
                    <BookCover book={b} compact />
                  </div>
                  <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {(state === "published" || state === "pending") && !ownerHidden ? (
                      <Link href={`/book/${b.id}`} className="break-words font-semibold text-stone-900 hover:text-indigo-600">
                        {b.title}
                      </Link>
                    ) : (
                      <span className="break-words font-semibold text-stone-900">{b.title}</span>
                    )}
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${STATE_STYLE[state]}`}
                    >
                      {modLabel}
                    </span>
                    {ownerHidden && (
                      <span className="inline-flex rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-medium text-stone-700 ring-1 ring-inset ring-stone-500/20">
                        Скрыто
                      </span>
                    )}
                  </div>
                  <p className="mt-1 break-words text-sm leading-5 text-stone-500">
                    {b.author} · {categoryLabels[b.category] ?? b.category}
                    {genres.length > 0 && ` · ${genres.join(", ")}`}
                    {b.views != null && ` · ${b.views} просм.`}
                  </p>
                  {state === "hidden" && (
                    <p className="mt-1 text-sm text-amber-800">
                      {b.hiddenUntil ? `Скрыта модерацией до ${fmtDate(b.hiddenUntil)}` : "Отклонено модерацией"}
                      {b.hiddenReason ? `. Причина: ${b.hiddenReason}` : ""}
                    </p>
                  )}
                  <p className="mt-1 min-h-5 text-sm leading-5 text-stone-600">
                    {ownerHidden ? (
                      <>Вы скрыли книгу — в каталоге её не видно.{state === "pending" && " Модерация продолжается."}</>
                    ) : null}
                  </p>
                  {state === "deleted" && b.deletedReason && (
                    <p className="mt-1 text-sm text-rose-700">Причина удаления: {b.deletedReason}</p>
                  )}
                  </div>
                </div>
                {/* Compact actions menu: no extra row, no squeezed text column. */}
                <details className="group relative z-10 shrink-0 self-start open:z-30">
                  <summary
                    className="flex min-h-9 cursor-pointer list-none items-center gap-1.5 rounded-full border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium text-stone-800 shadow-sm transition hover:bg-stone-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-olive-700 [&::-webkit-details-marker]:hidden"
                    aria-label={`Действия с книгой ${b.title}`}
                  >
                    <span className="hidden sm:inline">Действия</span>
                    <span className="sm:hidden">•••</span>
                    <svg aria-hidden="true" className="hidden h-4 w-4 transition-transform group-open:rotate-180 sm:block" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                  </summary>
                  <div className="absolute right-0 top-full z-40 mt-2 flex w-52 flex-col gap-1 rounded-xl border border-stone-200 bg-white p-2 shadow-xl">
                    <Link href={`/book/${b.id}/info`} className="rounded-lg px-3 py-2 text-sm text-stone-800 hover:bg-stone-100">
                      Информация
                    </Link>
                    {state !== "deleted" && (
                      <>
                        <Link
                          href={`/book/${b.id}/edit`}
                          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-stone-800 hover:bg-stone-100"
                          title="Редактировать"
                          aria-label={`Редактировать «${b.title}»`}
                        >
                          <FiEdit2 className={ICON_SIZE_SM} aria-hidden />
                          Изменить
                        </Link>
                        {state !== "hidden" && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void setHidden(b, !ownerHidden)}
                            className="rounded-lg px-3 py-2 text-left text-sm text-stone-800 hover:bg-stone-100 disabled:opacity-50"
                          >
                            {busy ? "Сохранение…" : ownerHidden ? "Опубликовать снова" : "Скрыть"}
                          </button>
                        )}
                        <div className="my-1 border-t border-stone-100" />
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => remove(b)}
                          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-left text-sm text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                          title="Удалить объявление"
                          aria-label={`Удалить «${b.title}»`}
                        >
                          <FiTrash2 className={ICON_SIZE_SM} aria-hidden />
                          Удалить
                        </button>
                      </>
                    )}
                  </div>
                </details>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}