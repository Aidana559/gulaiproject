"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "./Button";

type Review = {
  id: string;
  authorId: string;
  authorName: string;
  rating: number;
  text: string;
  createdAt: string;
};

function Stars({ value, onChange }: { value: number; onChange?: (n: number) => void }) {
  return (
    <div className="flex gap-0.5 text-xl">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={!onChange}
          onClick={() => onChange?.(n)}
          className={n <= value ? "text-amber-400" : "text-stone-300"}
        >
          ★
        </button>
      ))}
    </div>
  );
}

export default function ReviewsSection({
  bookId,
  ownerId,
}: {
  bookId: string | number;
  ownerId?: string;
}) {
  const { user } = useAuth();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [average, setAverage] = useState(0);
  const [rating, setRating] = useState(5);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [reportId, setReportId] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState("");
  const [reportMsg, setReportMsg] = useState("");

  const load = useCallback(async () => {
    const res = await fetch(
      `/api/reviews?targetType=book&targetId=${encodeURIComponent(String(bookId))}`,
      { cache: "no-store" },
    );
    if (!res.ok) return;
    const json = await res.json();
    setReviews(json.reviews ?? []);
    setAverage(json.average ?? 0);
  }, [bookId]);

  useEffect(() => {
    load();
  }, [load]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!user) {
      setError("Войдите, чтобы оставить отзыв");
      return;
    }
    const res = await fetch("/api/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        targetType: "book",
        targetId: String(bookId),
        rating,
        text,
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json.error ?? "Ошибка");
      return;
    }
    setText("");
    setRating(5);
    setDone(true);
    setTimeout(() => setDone(false), 2000);
    await load();
  }

  async function sendReport(reviewId: string) {
    setReportMsg("");
    if (reportReason.trim().length < 5) {
      setReportMsg("Опишите причину (мин. 5 символов)");
      return;
    }
    const res = await fetch("/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        targetType: "review",
        targetId: reviewId,
        reason: reportReason.trim(),
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setReportMsg(json.error ?? "Не удалось отправить");
      return;
    }
    setReportMsg("Жалоба отправлена");
    setReportReason("");
    setReportId(null);
  }

  return (
    <section className="mt-16 grid gap-10 lg:grid-cols-2">
      <div>
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold text-stone-900">Отзывы</h2>
          {reviews.length > 0 && (
            <span className="text-sm text-stone-500">
              ★ {average.toFixed(1)} ({reviews.length})
            </span>
          )}
        </div>

        {reviews.length === 0 ? (
          <p className="mt-4 text-sm text-stone-500">Пока нет отзывов.</p>
        ) : (
          <ul className="mt-4 space-y-4">
            {reviews.map((r) => (
              <li key={r.id} className="rounded-2xl bg-white p-5 ring-1 ring-stone-200">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium text-stone-900">{r.authorName}</p>
                  <Stars value={r.rating} />
                </div>
                {r.text && <p className="mt-2 text-sm text-stone-600">{r.text}</p>}
                <div className="mt-2 flex items-center justify-between gap-2">
                  <p className="text-xs text-stone-400">
                    {new Date(r.createdAt).toLocaleDateString("ru-RU")}
                  </p>
                  {user && user.id !== r.authorId && (
                    <button
                      type="button"
                      onClick={() => {
                        setReportId(reportId === r.id ? null : r.id);
                        setReportMsg("");
                      }}
                      className="text-xs text-stone-500 underline hover:text-rose-600"
                    >
                      Пожаловаться
                    </button>
                  )}
                </div>
                {reportId === r.id && (
                  <div className="mt-3 space-y-2 rounded-xl bg-stone-50 p-3">
                    <textarea
                      value={reportReason}
                      onChange={(e) => setReportReason(e.target.value)}
                      rows={2}
                      placeholder="Причина жалобы"
                      className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
                    />
                    {reportMsg && <p className="text-xs text-stone-600">{reportMsg}</p>}
                    <Button size="sm" variant="danger" onClick={() => sendReport(r.id)}>
                      Отправить жалобу
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h2 className="text-xl font-bold text-stone-900">Оставить отзыв</h2>
        <form onSubmit={submit} className="mt-4 space-y-4 rounded-2xl bg-white p-5 ring-1 ring-stone-200">
          <div>
            <p className="mb-1.5 text-sm font-medium text-stone-700">Оценка</p>
            <Stars value={rating} onChange={setRating} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-stone-700">Текст</label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={4}
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
              placeholder="Как прошло получение книги?"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          {done && (
            <p className="rounded-lg bg-emerald-50 p-2 text-sm text-emerald-700">✅ Сохранено</p>
          )}
          <Button type="submit" size="lg" full disabled={!user}>
            Отправить
          </Button>
        </form>
      </div>
    </section>
  );
}
