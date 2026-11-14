"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { genresOf } from "@/lib/genres";
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
};

type Tab = "published" | "hidden" | "deleted" | "all";
const TABS: { key: Tab; label: string }[] = [
  { key: "all", label: "Все" },
  { key: "published", label: "Опубликованные" },
  { key: "hidden", label: "Скрытые" },
  { key: "deleted", label: "Удалённые" },
];

/** Все объявления: скрыть (с причиной и сроком), опубликовать, изменить, удалить и восстановить. */
export default function BooksPanel() {
  const [books, setBooks] = useState<BookRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState<Tab>("all");
  const [busy, setBusy] = useState(false);
  const [dlg, setDlg] = useState<{ mode: ModerationMode; book: BookRow } | null>(null);
  const { toast, toastNode } = useToast();

  const load = useCallback(async () => {
    try {
      // «Опубликованные» включают книги на проверке; фильтруем на клиенте
      const state = tab === "published" ? "all" : tab;
      const res = await fetch(`/api/books?all=1&state=${state}&limit=100&sort=new`, { cache: "no-store" });
      const json = res.ok ? await res.json() : {};
      const list: BookRow[] = Array.isArray(json) ? json : Array.isArray(json?.books) ? json.books : [];
      setBooks(tab === "published" ? list.filter((b) => ["published", "pending"].includes(bookState(b))) : list);
    } catch {
      setBooks([]);
    } finally {
      setLoaded(true);
    }
  }, [tab]);

  useEffect(() => {
    // загрузка списка при открытии и при смене вкладки
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

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
      <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Состояние">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={chip(tab === t.key)}
            aria-pressed={tab === t.key}
            onClick={() => {
              setLoaded(false);
              setTab(t.key);
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-4 overflow-x-auto rounded-2xl bg-white ring-1 ring-stone-200">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b bg-stone-50 text-xs uppercase text-stone-500">
            <tr>
              <th className="p-3">Название</th>
              <th className="p-3">Автор</th>
              <th className="p-3">Жанры</th>
              <th className="p-3">Дата выхода</th>
              <th className="p-3">Статус</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {books.map((b) => {
              const state: BookState = bookState(b);
              return (
                <tr key={b.id} className={state === "deleted" ? "bg-rose-50/40" : state === "hidden" ? "bg-amber-50/40" : ""}>
                  <td className="p-3">
                    {state === "published" || state === "pending" ? (
                      <Link href={`/book/${b.id}`} className="font-medium hover:text-indigo-600">
                        {b.title}
                      </Link>
                    ) : (
                      <span className="font-medium">{b.title}</span>
                    )}
                  </td>
                  <td className="p-3 text-stone-600">
                    {b.author}
                    {b.owner && b.owner !== b.author && <p className="text-xs text-stone-400">добавил: {b.owner}</p>}
                  </td>
                  <td className="p-3 text-stone-600">{genresOf(b).join(", ") || "—"}</td>
                  <td className="whitespace-nowrap p-3 text-stone-600">{fmtDateTime(b.createdAt, APP_TZ)}</td>
                  <td className="p-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${STATE_STYLE[state]}`}
                    >
                      {stateLabel(state, b.hiddenUntil)}
                    </span>
                    {state === "hidden" && (
                      <p className="mt-1 text-xs text-stone-500">
                        {b.hiddenUntil ? `до ${fmtDate(b.hiddenUntil)}` : "бессрочно"}
                        {b.hiddenReason ? ` · ${b.hiddenReason}` : ""}
                      </p>
                    )}
                    {state === "deleted" && b.deletedReason && (
                      <p className="mt-1 text-xs text-stone-500">{b.deletedReason}</p>
                    )}
                  </td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-2">
                      <Link href={`/book/${b.id}/info`} className="rounded border px-2 py-1 text-xs">
                        Информация
                      </Link>
                      {state !== "deleted" && (
                        <Link href={`/book/${b.id}/edit`} className="rounded border px-2 py-1 text-xs">
                          Изменить
                        </Link>
                      )}
                      {state === "hidden" ? (
                        <button
                          type="button"
                          onClick={() => setDlg({ mode: "unhide", book: b })}
                          className="rounded bg-emerald-600 px-2 py-1 text-xs font-semibold text-white hover:bg-emerald-700"
                        >
                          Вернуть в каталог
                        </button>
                      ) : (
                        state !== "deleted" && (
                          <button
                            type="button"
                            onClick={() => setDlg({ mode: "hide", book: b })}
                            className="rounded border px-2 py-1 text-xs"
                          >
                            Скрыть
                          </button>
                        )
                      )}
                      {state === "deleted" ? (
                        <button
                          type="button"
                          onClick={() => setDlg({ mode: "restore", book: b })}
                          className="rounded border px-2 py-1 text-xs text-emerald-700"
                        >
                          Восстановить
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setDlg({ mode: "delete", book: b })}
                          className="rounded border px-2 py-1 text-xs text-red-600"
                        >
                          Удалить
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {loaded && books.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-stone-500">
                  Объявлений нет
                </td>
              </tr>
            )}
            {!loaded && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-stone-500">
                  Загрузка…
                </td>
              </tr>
            )}
          </tbody>
        </table>
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
