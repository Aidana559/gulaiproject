"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/Button";
import {
  REPORT_STATUSES,
  STATUS_LABEL,
  STATUS_STYLE,
  TARGET_LABEL,
} from "@/lib/reports";
import type { ReportStatus, ReportTargetType } from "@/lib/types";

type ReportRow = {
  id: string;
  targetType: ReportTargetType;
  targetId: string;
  reason: string;
  reasonCode?: string;
  comment?: string;
  status: ReportStatus;
  createdAt: string;
  updatedAt?: string;
  handledBy?: string;
  reporterName?: string;
  targetExists?: boolean;
  sameTargetCount?: number;
  bookTitle?: string;
  reviewText?: string;
  reviewAuthor?: string;
  userName?: string;
  bookId?: string;
};

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  muted?: boolean;
  blocked?: boolean;
};

type BookRow = {
  id: number | string;
  title: string;
  author: string;
  hidden?: boolean;
};

export default function ModerationPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [books, setBooks] = useState<BookRow[]>([]);
  const [tab, setTab] = useState<"reports" | "users" | "books">("reports");
  const [statusFilter, setStatusFilter] = useState<ReportStatus | "all">("all");
  const [typeFilter, setTypeFilter] = useState<ReportTargetType | "all">("all");
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [r, u, b] = await Promise.all([
      fetch("/api/reports", { cache: "no-store" }).then((x) => (x.ok ? x.json() : [])),
      fetch("/api/admin/users", { cache: "no-store" }).then((x) =>
        x.ok ? x.json() : { users: [] },
      ),
      fetch("/api/books?all=1&limit=50&sort=new", { cache: "no-store" }).then((x) =>
        x.ok ? x.json() : { books: [] },
      ),
    ]);
    setReports(Array.isArray(r) ? r : []);
    setUsers(u.users ?? []);
    setBooks(b.books ?? b ?? []);
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!user || (user.role !== "admin" && user.role !== "moderator")) {
      router.replace("/");
      return;
    }
    load();
  }, [user, loading, router, load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  async function setReport(id: string, status: ReportStatus) {
    const res = await fetch("/api/reports", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    setToast(res.ok ? `Статус: ${STATUS_LABEL[status]}` : "Не удалось изменить статус");
    await load();
  }

  async function deleteReviewFromReport(id: string) {
    if (!confirm("Удалить отзыв и закрыть жалобу?")) return;
    await fetch("/api/reports", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, deleteReview: true }),
    });
    setToast("Отзыв удалён");
    await load();
  }

  async function toggleMute(u: UserRow) {
    await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: u.id, muted: !u.muted }),
    });
    setToast(u.muted ? "Mute снят" : "Пользователь замьючен");
    await load();
  }

  async function hideBook(id: string | number, hidden: boolean) {
    await fetch(`/api/books/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hidden }),
    });
    await load();
  }

  async function delBook(id: string | number) {
    if (!confirm("Удалить объявление?")) return;
    await fetch(`/api/books/${id}`, { method: "DELETE" });
    await load();
  }

  if (loading || !user) {
    return <main className="flex min-h-[40vh] items-center justify-center text-stone-500">Загрузка…</main>;
  }

  const openReports = reports.filter((r) => r.status === "new");
  const visibleReports = reports.filter(
    (r) =>
      (statusFilter === "all" || r.status === statusFilter) &&
      (typeFilter === "all" || r.targetType === typeFilter),
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-extrabold text-stone-900">Модерация</h1>
      <p className="mt-2 text-stone-500">Жалобы, mute пользователей, объявления.</p>

      <div className="mt-6 flex flex-wrap gap-2">
        <Button size="sm" variant={tab === "reports" ? "primary" : "outline"} onClick={() => setTab("reports")}>
          Жалобы {openReports.length > 0 && `(${openReports.length} новых)`}
        </Button>
        <Button size="sm" variant={tab === "users" ? "primary" : "outline"} onClick={() => setTab("users")}>
          Пользователи / mute
        </Button>
        <Button size="sm" variant={tab === "books" ? "primary" : "outline"} onClick={() => setTab("books")}>
          Объявления
        </Button>
      </div>

      {tab === "reports" && (
        <>
          <div className="mt-6 flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant={statusFilter === "all" ? "primary" : "outline"}
              onClick={() => setStatusFilter("all")}
            >
              Все ({reports.length})
            </Button>
            {REPORT_STATUSES.map((st) => (
              <Button
                key={st}
                size="sm"
                variant={statusFilter === st ? "primary" : "outline"}
                onClick={() => setStatusFilter(st)}
              >
                {STATUS_LABEL[st]} ({reports.filter((r) => r.status === st).length})
              </Button>
            ))}
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as ReportTargetType | "all")}
              aria-label="Тип объекта"
              className="ml-auto rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm"
            >
              <option value="all">Все объекты</option>
              {(Object.keys(TARGET_LABEL) as ReportTargetType[]).map((t) => (
                <option key={t} value={t}>
                  {TARGET_LABEL[t]}
                </option>
              ))}
            </select>
          </div>

          <ul className="mt-4 space-y-3">
            {visibleReports.length === 0 && (
              <li className="rounded-2xl bg-white p-8 text-center text-stone-500 ring-1 ring-stone-200">
                Жалоб нет
              </li>
            )}
            {visibleReports.map((r) => {
              const targetUser =
                r.targetType === "user"
                  ? users.find((u) => String(u.id) === r.targetId)
                  : undefined;
              return (
                <li key={r.id} className="rounded-2xl bg-white p-5 ring-1 ring-stone-200">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${STATUS_STYLE[r.status]}`}
                        >
                          {STATUS_LABEL[r.status]}
                        </span>
                        <span className="text-xs font-medium uppercase text-stone-400">
                          {TARGET_LABEL[r.targetType]}
                        </span>
                        {(r.sameTargetCount ?? 1) > 1 && (
                          <span className="text-xs text-stone-400">
                            · жалоб на этот объект: {r.sameTargetCount}
                          </span>
                        )}
                      </div>

                      {r.targetType === "book" && (
                        <div className="mt-1">
                          {r.targetExists ? (
                            <Link
                              href={`/book/${r.targetId}`}
                              className="font-semibold text-indigo-700 hover:underline"
                            >
                              {r.bookTitle}
                            </Link>
                          ) : (
                            <p className="font-semibold text-stone-900">{r.bookTitle}</p>
                          )}
                        </div>
                      )}
                      {r.targetType === "review" && (
                        <div className="mt-1">
                          <p className="font-semibold text-stone-900">
                            {r.reviewAuthor ? `Отзыв от ${r.reviewAuthor}` : "Отзыв (удалён)"}
                          </p>
                          <p className="mt-1 text-sm text-stone-600">«{r.reviewText}»</p>
                          {r.bookId && (
                            <Link
                              href={`/book/${r.bookId}`}
                              className="text-sm text-indigo-600 hover:underline"
                            >
                              к книге {r.bookTitle}
                            </Link>
                          )}
                        </div>
                      )}
                      {r.targetType === "user" && (
                        <p className="mt-1 font-semibold text-stone-900">
                          {r.userName}
                          {targetUser?.muted && (
                            <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-normal text-amber-800">
                              mute
                            </span>
                          )}
                        </p>
                      )}

                      <p className="mt-2 text-sm text-stone-700">
                        <b>Причина:</b> {r.reason}
                      </p>
                      {r.comment && (
                        <p className="mt-1 text-sm text-stone-600">
                          <b>Комментарий:</b> {r.comment}
                        </p>
                      )}
                      <p className="mt-1 text-xs text-stone-400">
                        От {r.reporterName} · {new Date(r.createdAt).toLocaleString("ru-RU")}
                        {r.handledBy && ` · обработал(а): ${r.handledBy}`}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={r.status}
                        onChange={(e) => setReport(r.id, e.target.value as ReportStatus)}
                        aria-label="Статус жалобы"
                        className="rounded-lg border border-stone-300 bg-white px-2 py-1.5 text-sm"
                      >
                        {REPORT_STATUSES.map((st) => (
                          <option key={st} value={st}>
                            {STATUS_LABEL[st]}
                          </option>
                        ))}
                      </select>
                      {r.targetType === "review" && r.targetExists && (
                        <Button size="sm" variant="danger" onClick={() => deleteReviewFromReport(r.id)}>
                          Удалить отзыв
                        </Button>
                      )}
                      {r.targetType === "book" && r.targetExists && (
                        <>
                          <Button size="sm" variant="outline" onClick={() => hideBook(r.targetId, true)}>
                            Скрыть книгу
                          </Button>
                          <Button size="sm" variant="danger" onClick={() => delBook(r.targetId)}>
                            Удалить книгу
                          </Button>
                        </>
                      )}
                      {targetUser && targetUser.role !== "admin" && (
                        <Button
                          size="sm"
                          variant={targetUser.muted ? "outline" : "danger"}
                          onClick={() => toggleMute(targetUser)}
                        >
                          {targetUser.muted ? "Снять mute" : "Mute"}
                        </Button>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {tab === "users" && (
        <div className="mt-6 overflow-x-auto rounded-2xl bg-white ring-1 ring-stone-200">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="border-b bg-stone-50 text-xs uppercase text-stone-500">
              <tr>
                <th className="px-4 py-3">Имя</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Роль</th>
                <th className="px-4 py-3">Mute</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {users.map((u) => (
                <tr key={u.id} className={u.muted ? "bg-amber-50/50" : ""}>
                  <td className="px-4 py-3 font-medium">{u.name}</td>
                  <td className="px-4 py-3 text-stone-600">{u.email}</td>
                  <td className="px-4 py-3">{u.role}</td>
                  <td className="px-4 py-3">
                    {u.muted ? (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                        mute
                      </span>
                    ) : (
                      <span className="text-xs text-stone-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {u.role !== "admin" && (
                      <Button size="sm" variant={u.muted ? "outline" : "danger"} onClick={() => toggleMute(u)}>
                        {u.muted ? "Снять mute" : "Mute"}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "books" && (
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
                      onClick={() => hideBook(b.id, !b.hidden)}
                      className="rounded border px-2 py-1 text-xs"
                    >
                      {b.hidden ? "Показать" : "Скрыть"}
                    </button>
                    <button
                      type="button"
                      onClick={() => delBook(b.id)}
                      className="rounded border px-2 py-1 text-xs text-red-600"
                    >
                      Удалить
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-slate-900 px-5 py-2.5 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
