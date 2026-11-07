"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/Button";
import { useToast } from "./useToast";

type ReportRow = {
  id: string;
  targetType: "book" | "review";
  targetId: string;
  reason: string;
  status: "open" | "closed";
  createdAt: string;
  reporterName?: string;
  bookTitle?: string;
  reviewText?: string;
  reviewAuthor?: string;
  bookId?: string;
};

/** Жалобы на книги и отзывы — общий блок для панели модератора и панели администратора. */
export default function ReportsPanel() {
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [loaded, setLoaded] = useState(false);
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

  const setReport = (id: string, status: "open" | "closed") =>
    send(
      "/api/reports",
      "PATCH",
      { id, status },
      status === "closed" ? "Жалоба закрыта" : "Жалоба открыта",
    );

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

  const openCount = reports.filter((r) => r.status === "open").length;

  return (
    <>
      {loaded && (
        <p className="mt-4 text-sm text-stone-500">
          Открытых жалоб: <b className="text-stone-800">{openCount}</b> из {reports.length}
        </p>
      )}

      <ul className="mt-4 space-y-3">
        {!loaded && (
          <li className="rounded-2xl bg-white p-8 text-center text-stone-500 ring-1 ring-stone-200">
            Загрузка…
          </li>
        )}
        {loaded && reports.length === 0 && (
          <li className="rounded-2xl bg-white p-8 text-center text-stone-500 ring-1 ring-stone-200">
            Жалоб нет
          </li>
        )}
        {reports.map((r) => (
          <li key={r.id} className="rounded-2xl bg-white p-5 ring-1 ring-stone-200">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase text-stone-400">
                  {r.targetType === "review" ? "Отзыв" : "Книга"} ·{" "}
                  {r.status === "open" ? "открыта" : "закрыта"}
                </p>
                {r.targetType === "book" ? (
                  <Link
                    href={`/book/${r.targetId}`}
                    className="font-semibold text-indigo-700 hover:underline"
                  >
                    {r.bookTitle}
                  </Link>
                ) : (
                  <div>
                    <p className="font-semibold text-stone-900">Отзыв от {r.reviewAuthor}</p>
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
                <p className="mt-2 text-sm text-stone-700">
                  <b>Причина:</b> {r.reason}
                </p>
                <p className="mt-1 text-xs text-stone-400">
                  От {r.reporterName} · {new Date(r.createdAt).toLocaleString("ru-RU")}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {r.targetType === "review" && r.status === "open" && (
                  <Button size="sm" variant="danger" onClick={() => deleteReview(r.id)}>
                    Удалить отзыв
                  </Button>
                )}
                {r.targetType === "book" && (
                  <>
                    <Button size="sm" variant="outline" onClick={() => hideBook(r.targetId)}>
                      Скрыть книгу
                    </Button>
                    <Button size="sm" variant="danger" onClick={() => deleteBook(r.targetId)}>
                      Удалить книгу
                    </Button>
                  </>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setReport(r.id, r.status === "open" ? "closed" : "open")}
                >
                  {r.status === "open" ? "Закрыть жалобу" : "Открыть снова"}
                </Button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {toastNode}
    </>
  );
}
