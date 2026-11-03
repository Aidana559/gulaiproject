"use client";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { api } from "@/lib/api";
import { Stars } from "./Stars";

type Review = {
  id: string; authorId: string; authorName: string;
  rating: number; text: string; createdAt: string;
};

export default function ReviewsSection({
  bookId,
  ownerId,
}: {
  bookId: string | number;
  ownerId: string | number;
}) {
  const { user } = useAuth();
  const [data, setData] = useState<{ reviews: Review[]; average: number; count: number }>({
    reviews: [], average: 0, count: 0,
  });
  const [rating, setRating] = useState(5);
  const [text, setText] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setData(await api(`/api/reviews?targetType=book&targetId=${bookId}`));
  }, [bookId]);

  useEffect(() => { load(); }, [load]);

  const isOwner =
    !!user && (String(user.id) === String(ownerId) || user.name === String(ownerId));
  const isStaff = !!user && (user.role === "admin" || user.role === "moderator");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await api("/api/reviews", user!.id, {
        method: "POST",
        body: JSON.stringify({ targetType: "book", targetId: String(bookId), rating, text }),
      });
      setText("");
      load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function remove(id: string) {
    if (!confirm("Удалить отзыв?")) return;
    await api(`/api/reviews?id=${id}`, user!.id, { method: "DELETE" });
    load();
  }

  return (
    <section className="mt-16 grid gap-10 lg:grid-cols-2">
      <div>
        <h2 className="text-xl font-bold text-stone-900">
          Отзывы{" "}
          {data.count > 0 && (
            <span className="text-base font-normal text-stone-500">
              · {data.average.toFixed(1)} ★ ({data.count})
            </span>
          )}
        </h2>
        <ul className="mt-4 space-y-4">
          {data.reviews.map((r) => (
            <li key={r.id} className="rounded-2xl bg-white p-5 ring-1 ring-stone-200">
              <div className="flex items-center justify-between">
                <p className="font-medium text-stone-900">{r.authorName}</p>
                <Stars value={r.rating} className="text-base" />
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm text-stone-600">{r.text}</p>
              <div className="mt-2 flex gap-3 text-xs text-stone-400">
                <span>{new Date(r.createdAt).toLocaleDateString("ru-RU")}</span>
                {user && (String(user.id) === r.authorId || isStaff) && (
                  <button onClick={() => remove(r.id)} className="text-red-600">Удалить</button>
                )}
              </div>
            </li>
          ))}
          {data.reviews.length === 0 && <li className="text-stone-500">Отзывов пока нет.</li>}
        </ul>
      </div>

      <div>
        <h2 className="text-xl font-bold text-stone-900">Оставить отзыв</h2>
        <div className="mt-4 rounded-2xl bg-white p-5 ring-1 ring-stone-200">
          {user && !isOwner ? (
            <form onSubmit={submit} className="space-y-3">
              <Stars value={rating} onChange={setRating} />
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                maxLength={1000}
                required
                rows={4}
                placeholder="Ваш отзыв о книге"
                className="w-full rounded-xl border border-stone-300 p-3 text-sm"
              />
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button className="rounded-xl bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700">
                Отправить отзыв
              </button>
            </form>
          ) : (
            <p className="text-sm text-stone-500">
              {isOwner ? "Свою книгу оценивать нельзя." : "Войдите, чтобы оставить отзыв."}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}