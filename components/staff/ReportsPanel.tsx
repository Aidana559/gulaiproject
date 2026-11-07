"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/Button";
import {
  REPORT_STATUSES,
  STATUS_LABEL,
  STATUS_STYLE,
  TARGET_LABEL,
} from "@/lib/reports";
import type { ReportStatus, ReportTargetType } from "@/lib/types";
import { useToast } from "./useToast";

type ReportRow = {
  id: string;
  targetType: ReportTargetType;
  targetId: string;
  reason: string;
  comment?: string;
  status: ReportStatus;
  createdAt: string;
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

/** Жалобы на книги, отзывы и пользователей — общий блок для панели модератора и панели администратора. */
export default function ReportsPanel() {
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [statusFilter, setStatusFilter] = useState<ReportStatus | "all">("all");
  const [typeFilter, setTypeFilter] = useState<ReportTargetType | "all">("all");
  const { toast, toastNode } = useToast();

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/reports", { cache: "no-store" });
      const json = res.ok ? await res.json() : [];
      setReports(Array.isArray(json) ? json : []);
    } catch {
      setReports([]);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function send(url: string, method: string, body: unknown, okMsg: string) {
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        toast(json.error ?? "Ошибка");
        return;
      }
      toast(okMsg);
    } catch {
      toast("Нет связи с сервером");
      return;
    }
    await load();
  }

  const setReport = (id: string, status: ReportStatus) =>
    send("/api/reports", "PATCH", { id, status }, `Статус: ${STATUS_LABEL[status]}`);

  const deleteReview = (id: string) => {
    if (!confirm("Удалить отзыв и закрыть жалобу?")) return;
    return send("/api/reports", "PATCH", { id, deleteReview: true }, "Отзыв удалён");
  };

  const hideBook = (bookId: string) =>
    send(`/api/books/${bookId}`, "PATCH", { hidden: true }, "Книга скрыта");

  const deleteBook = (bookId: string) => {
    if (!confirm("Удалить объявление?")) return;
    return send(`/api/books/${bookId}`, "DELETE", undefined, "Объявление удалено");
  };

  const newCount = reports.filter((r) => r.status === "new").length;
  const visible = reports.filter(
    (r) =>
      (statusFilter === "all" || r.status === statusFilter) &&
      (typeFilter === "all" || r.targetType === typeFilter),
  );

  return (
    <>
      {loaded && (
        <p className="mt-4 text-sm text-stone-500">
          Новых жалоб: <b className="text-stone-800">{newCount}</b> из {reports.length}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
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
        {!loaded && (
          <li className="rounded-2xl bg-white p-8 text-center text-stone-500 ring-1 ring-stone-200">
            Загрузка…
          </li>
        )}
        {loaded && visible.length === 0 && (
          <li className="rounded-2xl bg-white p-8 text-center text-stone-500 ring-1 ring-stone-200">
            Жалоб нет
          </li>
        )}
        {visible.map((r) => (
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
                  <p className="mt-1 font-semibold text-stone-900">{r.userName}</p>
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
                  <Button size="sm" variant="danger" onClick={() => deleteReview(r.id)}>
                    Удалить отзыв
                  </Button>
                )}
                {r.targetType === "book" && r.targetExists && (
                  <>
                    <Button size="sm" variant="outline" onClick={() => hideBook(r.targetId)}>
                      Скрыть книгу
                    </Button>
                    <Button size="sm" variant="danger" onClick={() => deleteBook(r.targetId)}>
                      Удалить книгу
                    </Button>
                  </>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>

      {toastNode}
    </>
  );
}