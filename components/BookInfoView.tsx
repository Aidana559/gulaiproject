"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { FiArrowLeft, FiEdit2 } from "react-icons/fi";
import { useAuth } from "@/components/AuthProvider";
import BookCover from "@/components/BookCover";
import ModerationCard from "@/components/ModerationCard";
import ModerationDialog, {
  type ModerationMode,
  type ModerationPayload,
} from "@/components/staff/ModerationDialog";
import { categoryLabels, type Book } from "@/data/books";
import {
  STATE_STYLE,
  fmtDate,
  fmtDateTime,
  stateLabel,
  type BookState,
  type ModerationEntry,
} from "@/lib/moderation-shared";
import { useTaxonomy } from "@/components/TaxonomyProvider";

type Info = {
  id: number | string;
  title: string;
  author: string;
  description?: string;
  coverUrl: string | null;
  gradient: string;
  category: Book["category"];
  genres: string[];
  publishedAt: string | null;
  /** книгу скрыл сам автор (видимость, не статус модерации) */
  ownerHidden?: boolean;
  state: BookState;
  stateLabel: string;
  hiddenReason: string | null;
  hiddenUntil: string | null;
  hiddenBy: { id: string; name: string; role: string } | null;
  deletedReason: string | null;
  deletedAt: string | null;
  deletedBy: { id: string; name: string; role: string } | null;
  history: ModerationEntry[];
  admin?: {
    authorId: string | null;
    authorName: string;
    authorEmail: string | null;
    createdAt: string | null;
    updatedAt: string | null;
    views: number;
    reviewed: boolean;
  };
};

const ROLE: Record<string, string> = { admin: "Администратор", moderator: "Модератор", user: "Автор", system: "Система" };

function Item({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-stone-400">{label}</dt>
      <dd className="mt-0.5 break-words font-medium text-stone-900">{children}</dd>
    </div>
  );
}

/** Подробная информация о книге для автора и администрации: статус, жанры, причины и история. */
export default function BookInfoView() {
  useTaxonomy(); // подписка: подписи категорий обновляются, когда администратор их меняет
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const [info, setInfo] = useState<Info | null>(null);
  const [error, setError] = useState("");
  const [dialog, setDialog] = useState<ModerationMode | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/books/${id}/moderation`, { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          res.status === 401
            ? "Войдите, чтобы увидеть информацию о книге"
            : res.status === 403
              ? "Информация о книге доступна только её автору и администрации"
              : (json.error ?? "Не удалось загрузить"),
        );
        return;
      }
      setInfo(json as Info);
      setError("");
    } catch {
      setError("Нет связи с сервером");
    }
  }, [id]);

  useEffect(() => {
    if (authLoading) return;
    // загрузка данных при открытии страницы / смене пользователя
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [authLoading, user, load]);

  const staff = user?.role === "admin" || user?.role === "moderator";

  async function act(mode: ModerationMode, p: ModerationPayload) {
    setBusy(true);
    setMsg("");
    try {
      const res =
        mode === "delete"
          ? await fetch(`/api/books/${id}`, {
              method: "DELETE",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ reason: p.reason }),
            })
          : await fetch(`/api/books/${id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body:
                mode === "hide"
                  ? JSON.stringify({ hidden: true, reason: p.reason, hideDays: p.hideDays, hiddenUntil: p.hiddenUntil })
                  : JSON.stringify(
                      info?.state === "deleted"
                        ? { restore: true, reason: p.reason }
                        : { hidden: false, reason: p.reason },
                    ),
            });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) setMsg(json.error ?? "Ошибка");
      else setDialog(null);
    } catch {
      setMsg("Нет связи с сервером");
    } finally {
      setBusy(false);
      await load();
    }
  }

  if (error) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <p className="rounded-2xl bg-white p-8 text-stone-600 ring-1 ring-stone-200">{error}</p>
        <Link href="/catalog" className="mt-4 inline-block text-sm text-indigo-600 hover:underline">
          В каталог
        </Link>
      </div>
    );
  }
  if (!info) return <p className="p-16 text-center text-stone-500">Загрузка…</p>;

  const book = { ...info, owner: "", status: "available", genre: "", city: "", year: 0, pages: 0 } as unknown as Book;
  const visible = info.state === "published" || info.state === "pending";

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <nav className="text-sm text-stone-500">
        <Link href={staff ? (user?.role === "admin" ? "/admin/books" : "/moderation/books") : "/profile"} className="hover:text-indigo-600">
          {staff ? "Объявления" : "Профиль"}
        </Link>{" "}
        / Информация о книге
      </nav>

      <div className="mt-6 grid gap-8 md:grid-cols-[14rem_1fr]">
        <div className="max-w-[14rem]">
          <BookCover book={book} />
        </div>

        <div className="min-w-0">
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${STATE_STYLE[info.state]}`}
          >
            {stateLabel(info.state, info.hiddenUntil)}
          </span>
          <h1 className="mt-2 text-2xl font-extrabold text-stone-900 sm:text-3xl">{info.title}</h1>
          <p className="text-stone-500">{info.author}</p>
          {info.description && <p className="mt-4 whitespace-pre-line text-stone-700">{info.description}</p>}

          <div className="mt-4" aria-label="Жанры">
            <p className="mb-1.5 text-xs text-stone-400">Жанры</p>
            {info.genres.length ? (
              <ul className="flex flex-wrap gap-2">
                {info.genres.map((g) => (
                  <li key={g}>
                    <Link
                      href={`/catalog?genre=${encodeURIComponent(g)}`}
                      className="rounded-full bg-indigo-50 px-3 py-1 text-sm font-medium text-indigo-700 ring-1 ring-inset ring-indigo-200 hover:bg-indigo-100"
                    >
                      {g}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-stone-500">Жанры не указаны</p>
            )}
          </div>

          <dl className="mt-6 grid grid-cols-1 gap-4 rounded-2xl bg-white p-5 text-sm ring-1 ring-stone-200 sm:grid-cols-2">
            <Item label="Категория">{categoryLabels[info.category] ?? info.category}</Item>
            <Item label="Дата публикации">{fmtDate(info.publishedAt)}</Item>
            <Item label="Текущий статус">{stateLabel(info.state, info.hiddenUntil)}</Item>
            {info.ownerHidden && <Item label="Видимость">Скрыта автором — в каталоге не отображается</Item>}

            {info.state === "hidden" && (
              <>
                <Item label="Причина скрытия">{info.hiddenReason ?? "не указана"}</Item>
                <Item label="Срок скрытия">
                  {info.hiddenUntil ? `до ${fmtDate(info.hiddenUntil)}` : "бессрочно"}
                </Item>
                {info.hiddenBy && (
                  <Item label="Скрыл">
                    {ROLE[info.hiddenBy.role] ?? ""} {info.hiddenBy.name}
                  </Item>
                )}
              </>
            )}

            {info.state === "deleted" && (
              <>
                <Item label="Причина удаления">{info.deletedReason ?? "не указана"}</Item>
                <Item label="Дата удаления">{fmtDateTime(info.deletedAt)}</Item>
                {info.deletedBy && (
                  <Item label="Удалил">
                    {ROLE[info.deletedBy.role] ?? ""} {info.deletedBy.name}
                  </Item>
                )}
              </>
            )}

            {info.admin && (
              <>
                <Item label="Автор">{info.admin.authorName}</Item>
                <Item label="Идентификатор автора">
                  <span className="font-mono text-xs">{info.admin.authorId ?? "—"}</span>
                </Item>
                {info.admin.authorEmail && <Item label="Email автора">{info.admin.authorEmail}</Item>}
                <Item label="Создана">{fmtDateTime(info.admin.createdAt)}</Item>
                <Item label="Последнее изменение">{fmtDateTime(info.admin.updatedAt)}</Item>
                <Item label="Проверка модератором">{info.admin.reviewed ? "пройдена" : "не проведена"}</Item>
                <Item label="Просмотры">{info.admin.views}</Item>
              </>
            )}
          </dl>

          <div className="mt-5 flex flex-wrap gap-2">
            {visible && (
              <Link
                href={`/book/${info.id}`}
                className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-stone-800 ring-1 ring-inset ring-stone-300 hover:bg-stone-50"
              >
                <FiArrowLeft /> Страница книги
              </Link>
            )}
            {info.state !== "deleted" && (
              <Link
                href={`/book/${info.id}/edit`}
                className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-stone-800 ring-1 ring-inset ring-stone-300 hover:bg-stone-50"
              >
                <FiEdit2 /> Изменить
              </Link>
            )}
            {staff && info.state !== "deleted" && info.state !== "hidden" && (
              <button type="button" className="mq-btn" onClick={() => setDialog("hide")}>
                Скрыть…
              </button>
            )}
            {staff && info.state === "hidden" && (
              <>
                <button type="button" className="mq-btn" onClick={() => setDialog("restore")}>
                  Опубликовать снова
                </button>
                <button type="button" className="mq-btn" onClick={() => setDialog("hide")}>
                  Изменить срок…
                </button>
              </>
            )}
            {staff && info.state !== "deleted" && (
              <button type="button" className="mq-btn mq-btn-danger" onClick={() => setDialog("delete")}>
                Удалить…
              </button>
            )}
            {staff && info.state === "deleted" && (
              <button type="button" className="mq-btn mq-btn-ok" onClick={() => setDialog("restore")}>
                Восстановить
              </button>
            )}
          </div>
          {msg && (
            <p role="alert" className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {msg}
            </p>
          )}
        </div>
      </div>

      <section className="mt-10" aria-labelledby="hist">
        <h2 id="hist" className="text-lg font-bold text-stone-900">
          {staff ? "История модерации" : "История действий администрации"}
        </h2>
        {info.history.length === 0 ? (
          <p className="mt-3 rounded-2xl bg-white p-6 text-sm text-stone-500 ring-1 ring-stone-200">
            Действий администрации с этой книгой пока не было.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {info.history.map((e) => (
              <li key={e.id}>
                <ModerationCard entry={e} showLink={false} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {dialog && (
        <ModerationDialog
          mode={dialog}
          bookTitle={info.title}
          busy={busy}
          onSubmit={(p) => act(dialog, p)}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  );
}
