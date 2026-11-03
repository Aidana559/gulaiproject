"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { categoryLabels } from "@/data/books";
import { api } from "@/lib/api";

type Genre = { id: string; name: string; type: "genre" | "category" };

export default function EditBookPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState<Record<string, any> | null>(null);
  const [genres, setGenres] = useState<Genre[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;
    api(`/api/books/${id}`, user.id).then(setForm).catch((e) => setError(e.message));
    api("/api/genres").then(setGenres).catch(() => {});
  }, [id, user]);

  if (!user) return <p className="p-6">Войдите, чтобы редактировать.</p>;
  if (error && !form) return <p className="p-6 text-red-600">{error}</p>;
  if (!form) return <p className="p-6">Загрузка…</p>;

  const allowed =
    String(form.ownerId) === String(user.id) ||
    form.owner === user.name ||
    user.role === "admin" ||
    user.role === "moderator";
  if (!allowed) return <p className="p-6">Нет прав на редактирование.</p>;

  const set = (k: string, v: string) => setForm({ ...form, [k]: v });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const { title, author, description, genre, category, status, city } = form!;
      await api(`/api/books/${id}`, user!.id, {
        method: "PATCH",
        body: JSON.stringify({ title, author, description, genre, category, status, city }),
      });
      router.push(`/books/${id}`);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    }
  }

  const input = "w-full rounded-xl border border-stone-300 p-3 text-sm";
  const label = "block text-sm font-medium text-stone-700";

  return (
    <form onSubmit={save} className="mx-auto max-w-xl space-y-4 px-4 py-10">
      <h1 className="text-2xl font-extrabold text-stone-900">Редактирование объявления</h1>

      <label className={label}>Название
        <input className={input} value={form.title ?? ""} onChange={(e) => set("title", e.target.value)} required />
      </label>
      <label className={label}>Автор
        <input className={input} value={form.author ?? ""} onChange={(e) => set("author", e.target.value)} />
      </label>
      <label className={label}>Описание
        <textarea className={input} rows={4} value={form.description ?? ""} onChange={(e) => set("description", e.target.value)} />
      </label>
      <label className={label}>Категория
        <select className={input} value={form.category ?? ""} onChange={(e) => set("category", e.target.value)}>
          {Object.entries(categoryLabels as Record<string, string>).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </label>
      <label className={label}>Жанр / предмет
        <input
          className={input}
          list="genre-list"
          value={form.genre ?? ""}
          onChange={(e) => set("genre", e.target.value)}
        />
        <datalist id="genre-list">
          {genres.filter((g) => g.type === "genre").map((g) => <option key={g.id} value={g.name} />)}
        </datalist>
      </label>
      <label className={label}>Город / корпус
        <input className={input} value={form.city ?? ""} onChange={(e) => set("city", e.target.value)} />
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button className="rounded-xl bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700">Сохранить</button>
        <button type="button" onClick={() => router.back()} className="rounded-xl px-5 py-2 text-sm font-medium ring-1 ring-stone-300">Отмена</button>
      </div>
    </form>
  );
}