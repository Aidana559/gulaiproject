"use client";

import UserLink from "@/components/UserLink";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import BookCover from "@/components/BookCover";
import type { Book } from "@/data/books";
import { genresOf } from "@/lib/genres";
import { matchesListingFilter, type ListingFilter } from "@/lib/listing-access";
import {
  STATE_STYLE,
  bookState,
  APP_TZ,
  fmtDate,
  fmtDateTime,
  stateLabel,
  type BookState,
} from "@/lib/moderation-shared";
import ModerationDialog, { type ModerationMode, type ModerationPayload } from "./ModerationDialog";
import { useToast } from "./useToast";
import { FiEdit2, FiTrash2, FiInfo, FiEye, FiEyeOff, FiRotateCcw, FiMoreHorizontal, FiSearch, FiX } from "react-icons/fi";
import { ICON_SIZE_SM } from "@/components/CategoryIcon";

type BookRow = {
  id: number | string;
  title: string;
  author: string;
  owner?: string;
  genre?: string;
  genres?: string[];
  createdAt?: string;
  hidden?: boolean;
  hiddenUntil?: string | null;
  hiddenReason?: string;
  deleted?: boolean;
  deletedReason?: string;
  ownerId?: string;
  reviewed?: boolean;
  
  ownerHidden?: boolean;
  coverUrl?: string | null;
};

type Tab = ListingFilter | "deleted";


const TABS: { key: Tab; label: string }[] = [
  { key: "all", label: "Все" },
  { key: "published", label: "Опубликовано" },
  { key: "pending", label: "На модерации" },
  { key: "hidden", label: "Скрыто" },
  { key: "rejected", label: "Отклонено" },
  { key: "deleted", label: "Удалённые" },
];

type Sort = "new" | "old" | "az" | "za";
const SORTS: { key: Sort; label: string }[] = [
  { key: "new", label: "Сначала новые" },
  { key: "old", label: "Сначала старые" },
  { key: "az", label: "По названию А–Я" },
  { key: "za", label: "По названию Я–А" },
];

const norm = (v: unknown) => String(v ?? "").toLowerCase().replace(/ё/g, "е").replace(/\s+/g, " ").trim();
const matchesTab = (b: BookRow, t: Tab) => (t === "deleted" ? !!b.deleted : t === "all" ? true : matchesListingFilter(b, t));
const time = (b: BookRow) => {
  const n = b.createdAt ? new Date(b.createdAt).getTime() : NaN;
  return Number.isFinite(n) ? n : null;
};


function RowMenu({ label, children }: { label: string; children: (close: () => void) => React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [up, setUp] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        btn.current?.focus({ preventScroll: true });
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrap} className={`relative shrink-0 ${open ? "z-30" : ""}`}>
      <button
        ref={btn}
        type="button"
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => {
          if (!open && btn.current) {
            const r = btn.current.getBoundingClientRect();
            setUp(window.innerHeight - r.bottom < 230 && r.top > 230);
          }
          setOpen((v) => !v);
        }}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-lg font-bold leading-none text-stone-700 ring-1 ring-inset ring-stone-300 transition hover:bg-indigo-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
      >
        <FiMoreHorizontal className="h-5 w-5" aria-hidden />
      </button>
      {open && (
        <div
          role="menu"
          className={`absolute right-0 z-40 w-52 rounded-xl border border-stone-200 bg-white p-1.5 shadow-xl ${
            up ? "bottom-full mb-2" : "top-full mt-2"
          }`}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

const menuItem = "flex items-center gap-2 w-full rounded-lg px-3 py-2 text-left text-sm text-stone-800 hover:bg-stone-100 focus-visible:bg-stone-100 focus-visible:outline-none";


export default function BooksPanel() {
  const [books, setBooks] = useState<BookRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState<Tab>("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("new");
  const [busy, setBusy] = useState(false);
  const [dlg, setDlg] = useState<{ mode: ModerationMode; book: BookRow } | null>(null);
  const { toast, toastNode } = useToast();

  
  
  const load = useCallback(async () => {
    try {
      const all: BookRow[] = [];
      for (let page = 1; page <= 20; page++) {
        const res = await fetch(`/api/books?all=1&state=all&limit=100&sort=new&page=${page}`, { cache: "no-store" });
        if (!res.ok) throw new Error("load");
        const json = await res.json();
        const list: BookRow[] = Array.isArray(json) ? json : Array.isArray(json?.books) ? json.books : [];
        all.push(...list);
        if (Array.isArray(json) || page >= (Number(json?.pages) || 1)) break;
      }
      setBooks(all);
    } catch {
      
      setBooks((prev) => prev);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  
  const searched = useMemo(() => {
    const q = norm(query);
    if (!q) return books;
    return books.filter((b) => norm(b.title).includes(q) || norm(b.author).includes(q) || norm(b.owner).includes(q));
  }, [books, query]);

  const counts = useMemo(
    () => Object.fromEntries(TABS.map((t) => [t.key, searched.filter((b) => matchesTab(b, t.key)).length])) as Record<Tab, number>,
    [searched],
  );

  const rows = useMemo(() => {
    const list = searched.filter((b) => matchesTab(b, tab));
    const byTitle = (x: BookRow, y: BookRow) =>
      String(x.title ?? "").localeCompare(String(y.title ?? ""), "ru", { sensitivity: "base", numeric: true });
    const byDate = (dir: 1 | -1) => (x: BookRow, y: BookRow) => {
      const a = time(x);
      const b = time(y);
      if (a === null && b === null) return byTitle(x, y);
      if (a === null) return 1; 
      if (b === null) return -1;
      return a === b ? byTitle(x, y) : (a - b) * dir;
    };
    return [...list].sort(sort === "az" ? byTitle : sort === "za" ? (x, y) => byTitle(y, x) : byDate(sort === "new" ? -1 : 1));
  }, [searched, tab, sort]);

  const isDefault = tab === "all" && sort === "new" && query === "";
  const resetFilters = () => {
    setTab("all");
    setSort("new");
    setQuery("");
  };

  async function run(mode: ModerationMode, b: BookRow, p: ModerationPayload) {
    setBusy(true);
    try {
      const res =
        mode === "delete"
          ? await fetch(`/api/books/${b.id}`, {
              method: "DELETE",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ reason: p.reason }),
            })
          : await fetch(`/api/books/${b.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(
                mode === "hide"
                  ? { hidden: true, reason: p.reason, hideDays: p.hideDays, hiddenUntil: p.hiddenUntil }
                  : b.deleted
                    ? { restore: true, reason: p.reason }
                    : { hidden: false, reason: p.reason },
              ),
            });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast(json.error ?? "Ошибка");
        return;
      }
      toast(
        mode === "hide"
          ? "Объявление скрыто, автор уведомлён"
          : mode === "delete"
            ? "Объявление удалено, автор уведомлён"
            : mode === "unhide"
              ? "Книга возвращена в каталог, автор уведомлён"
              : b.deleted
              ? "Объявление восстановлено, автор уведомлён"
              : "Объявление опубликовано, автор уведомлён",
      );
      setDlg(null);
    } catch {
      toast("Нет связи с сервером");
    } finally {
      setBusy(false);
    }
    await load();
  }

  const chip = (on: boolean) =>
    `rounded-full px-3 py-1 text-sm font-medium ring-1 ring-inset ${
      on ? "bg-indigo-600 text-white ring-indigo-600" : "bg-white text-stone-700 ring-stone-300 hover:bg-indigo-50"
    }`;

  return (
    <>
      
      <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] lg:grid-cols-[minmax(0,1fr)_14rem_auto]">
        <div className="relative sm:col-span-2 lg:col-span-1">
          <label htmlFor="books-search" className="sr-only">
            Поиск объявлений
          </label>
          <FiSearch aria-hidden className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-500" />
          <input
            id="books-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск: название, автор или владелец"
            autoComplete="off"
            className="w-full rounded-full bg-white pl-10 pr-4 py-2.5 text-sm text-stone-900 ring-1 ring-inset ring-stone-300 placeholder:text-stone-400 focus:outline focus:outline-2 focus:outline-indigo-600"
          />
        </div>
        <div>
          <label htmlFor="books-sort" className="sr-only">
            Сортировка
          </label>
          <select
            id="books-sort"
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            className="w-full rounded-full bg-white px-4 py-2.5 text-sm text-stone-900 ring-1 ring-inset ring-stone-300 focus:outline focus:outline-2 focus:outline-indigo-600"
          >
            {SORTS.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={resetFilters}
          disabled={isDefault}
          className="rounded-full bg-white px-4 py-2.5 text-sm font-medium text-stone-700 ring-1 ring-inset ring-stone-300 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <FiX className="mr-1 inline h-4 w-4" aria-hidden /> Сбросить фильтры
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Статус объявления">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={chip(tab === t.key)}
            aria-pressed={tab === t.key}
            onClick={() => setTab(t.key)}
          >
            {t.label}
            {loaded && <span className={`ml-1.5 text-xs ${tab === t.key ? "text-indigo-100" : "text-stone-400"}`}>{counts[t.key]}</span>}
          </button>
        ))}
      </div>

      <p className="mt-3 min-h-5 text-sm text-stone-500" role="status" aria-live="polite">
        {loaded ? (
          <>
            Найдено: <span className="font-semibold text-stone-700">{rows.length}</span>
            {rows.length !== books.length && <> из {books.length}</>}
          </>
        ) : null}
      </p>

      
      <div className="mt-2 min-h-[22rem] [overflow-anchor:none]">
        {!loaded && <p className="rounded-2xl bg-white px-4 py-10 text-center text-sm text-stone-500 ring-1 ring-stone-200">Загрузка…</p>}
        {loaded && rows.length === 0 && (
          <p className="rounded-2xl bg-white px-4 py-10 text-center text-sm text-stone-500 ring-1 ring-stone-200">
            {books.length === 0 ? (
              "Объявлений нет"
            ) : (
              <>
                По вашему запросу ничего не найдено.{" "}
                <button type="button" onClick={resetFilters} className="font-medium text-indigo-700 underline">
                  Сбросить фильтры
                </button>
              </>
            )}
          </p>
        )}
        <ul className="space-y-3">
          {rows.map((b) => {
            const state: BookState = bookState(b);
            const genres = genresOf(b).join(", ");
            return (
              <li
                key={b.id}
                className={`flex min-w-0 items-start gap-3 rounded-2xl p-3 ring-1 ring-stone-200 sm:gap-4 sm:p-4 ${
                  state === "deleted" ? "bg-rose-50/60" : state === "hidden" ? "bg-amber-50/60" : "bg-white"
                }`}
              >
                <div className="w-14 shrink-0 sm:w-16">
                  <BookCover book={b as unknown as Book} compact />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                    {state === "published" || state === "pending" ? (
                      <Link href={`/book/${b.id}`} className="min-w-0 break-words font-semibold text-stone-900 hover:text-indigo-600">
                        {b.title}
                      </Link>
                    ) : (
                      <span className="min-w-0 break-words font-semibold text-stone-900">{b.title}</span>
                    )}
                    <span
                      className={`inline-flex shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${STATE_STYLE[state]}`}
                    >
                      {state === "hidden" ? "Отклонено" : stateLabel(state, b.hiddenUntil)}
                    </span>
                    {b.ownerHidden && state !== "deleted" && (
                      <span className="inline-flex shrink-0 rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-medium text-stone-700 ring-1 ring-inset ring-stone-500/20">
                        Скрыто автором
                      </span>
                    )}
                  </div>
                  <p className="mt-1 break-words text-sm text-stone-600">{b.author}</p>
                  <p className="mt-0.5 break-words text-xs text-stone-500">
                    {b.owner ? <>Владелец: <UserLink userId={b.ownerId}>{b.owner}</UserLink></> : "Владелец не указан"}
                    {" · "}
                    {fmtDateTime(b.createdAt, APP_TZ)}
                    {genres && ` · ${genres}`}
                  </p>
                  {state === "hidden" && (
                    <p className="mt-1.5 break-words text-xs text-amber-800">
                      {b.hiddenUntil ? `до ${fmtDate(b.hiddenUntil)}` : "бессрочно"}
                      {b.hiddenReason ? ` · ${b.hiddenReason}` : ""}
                    </p>
                  )}
                  {state === "deleted" && b.deletedReason && (
                    <p className="mt-1.5 break-words text-xs text-rose-700">{b.deletedReason}</p>
                  )}
                </div>

                <RowMenu label={`Действия: ${b.title}`}>
                  {(close) => (
                    <>
                      <Link href={`/book/${b.id}/info`} role="menuitem" className={menuItem} onClick={close}>
                        <FiInfo className={ICON_SIZE_SM} aria-hidden /> Информация
                      </Link>
                      {state !== "deleted" && (
                        <Link href={`/book/${b.id}/edit`} role="menuitem" className={menuItem} onClick={close} title="Редактировать" aria-label={`Редактировать «${b.title}»`}>
                          <FiEdit2 className={ICON_SIZE_SM} aria-hidden />
                          Изменить
                        </Link>
                      )}
                      {state === "hidden" ? (
                        <button
                          type="button"
                          role="menuitem"
                          className={`${menuItem} font-medium text-emerald-700`}
                          onClick={() => {
                            close();
                            setDlg({ mode: "unhide", book: b });
                          }}
                        >
                          <FiEye className={ICON_SIZE_SM} aria-hidden /> Вернуть в каталог
                        </button>
                      ) : (
                        state !== "deleted" && (
                          <button
                            type="button"
                            role="menuitem"
                            className={menuItem}
                            onClick={() => {
                              close();
                              setDlg({ mode: "hide", book: b });
                            }}
                          >
                            <FiEyeOff className={ICON_SIZE_SM} aria-hidden /> Скрыть
                          </button>
                        )
                      )}
                      <div className="my-1 border-t border-stone-100" />
                      {state === "deleted" ? (
                        <button
                          type="button"
                          role="menuitem"
                          className={`${menuItem} text-emerald-700`}
                          onClick={() => {
                            close();
                            setDlg({ mode: "restore", book: b });
                          }}
                        >
                          <FiRotateCcw className={ICON_SIZE_SM} aria-hidden /> Восстановить
                        </button>
                      ) : (
                        <button
                          type="button"
                          role="menuitem"
                          className={`${menuItem} text-red-600 hover:bg-rose-50`}
                          onClick={() => {
                            close();
                            setDlg({ mode: "delete", book: b });
                          }}
                          title="Удалить объявление"
                          aria-label={`Удалить «${b.title}»`}
                        >
                          <FiTrash2 className={ICON_SIZE_SM} aria-hidden />
                          Удалить
                        </button>
                      )}
                    </>
                  )}
                </RowMenu>
              </li>
            );
          })}
        </ul>
      </div>

      {dlg && (
        <ModerationDialog
          mode={dlg.mode}
          bookTitle={dlg.book.title}
          busy={busy}
          onSubmit={(p) => run(dlg.mode, dlg.book, p)}
          onClose={() => setDlg(null)}
        />
      )}
      {toastNode}
    </>
  );
}
