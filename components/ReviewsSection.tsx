"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { FaStar } from "react-icons/fa";
import { FiCheckCircle, FiFlag } from "react-icons/fi";
import { Button } from "./Button";
import { Stars } from "./Stars";
import ReportModal from "./ReportModal";

type Review = {
  id: string;
  authorId: string;
  authorName: string;
  rating: number;
  text: string;
  createdAt: string;
};

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

  return (
    <section className="mt-16 grid gap-10 lg:grid-cols-2">
      <div>
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold text-stone-900">Отзывы</h2>
          {reviews.length > 0 && (
            <span className="text-sm text-stone-500">
              <FaStar className="mr-1 inline text-amber-400" />
              {average.toFixed(1)} ({reviews.length})
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
                      onClick={() => setReportId(r.id)}
                      className="inline-flex items-center gap-1 text-xs text-stone-500 hover:text-rose-600"
                    >
                      <FiFlag /> Пожаловаться
                    </button>
                  )}
                </div>
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
            <p className="flex items-center gap-2 rounded-lg bg-emerald-50 p-2 text-sm text-emerald-700">
              <FiCheckCircle /> Сохранено
            </p>
          )}
          <Button type="submit" size="lg" full disabled={!user}>
            Отправить
          </Button>
        </form>
      </div>
      <ReportModal
        open={reportId !== null}
        onClose={() => setReportId(null)}
        targetType="review"
        targetId={reportId ?? ""}
        title="Жалоба на отзыв"
      />
    </section>
  );
}
