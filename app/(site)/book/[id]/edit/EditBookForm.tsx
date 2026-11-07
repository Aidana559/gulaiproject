"use client";

import GenreSelect from "@/components/GenreSelect";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { categoryLabels } from "@/data/books";

type Form = {
  title?: string;
  author?: string;
  description?: string;
  genre?: string;
  category?: string;
  status?: string;
  city?: string;
  campus?: string;
  condition?: string;
  year?: string | number;
  pages?: string | number;
  coverUrl?: string | null;
};

export default function EditBookForm() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [form, setForm] = useState<Form | null>(null);
  const [ownerId, setOwnerId] = useState<string>("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/books/${id}?view=0`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((b) => {
        if (!b) {
          setError("Книга не найдена");
          return;
        }
        setOwnerId(String(b.ownerId ?? b.owner ?? ""));
        setForm({
          title: b.title,
          author: b.author,
          description: b.description,
          genre: b.genre,
          category: b.category,
          status: b.status,
          city: b.city,
          campus: b.campus ?? "",
          condition: b.condition ?? "used",
          year: b.year ?? "",
          pages: b.pages ?? "",
          coverUrl: b.coverUrl ?? null,
        });
      })
      .catch(() => setError("Не удалось загрузить"));
  }, [id]);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login");
  }, [authLoading, user, router]);

  if (authLoading || !form) {
    return <p className="p-10 text-center text-stone-500">Загрузка…</p>;
  }
  if (!user) return null;

  const allowed =
    String(user.id) === ownerId ||
    user.name === ownerId ||
    user.role === "admin" ||
    user.role === "moderator";
  if (!allowed) return <p className="p-6">Нет прав на редактирование.</p>;

  const set = (k: keyof Form, v: string) => setForm({ ...form, [k]: v });

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const fd = new FormData(e.currentTarget);
      fd.set("title", form!.title ?? "");
      fd.set("author", form!.author ?? "");
      fd.set("description", form!.description ?? "");
      fd.set("genre", form!.genre ?? "");
      fd.set("category", form!.category ?? "book");
      fd.set("city", form!.city ?? "");
      fd.set("campus", form!.campus ?? "");
      fd.set("condition", form!.condition ?? "used");
      if (form!.year) fd.set("year", String(form!.year));
      if (form!.pages) fd.set("pages", String(form!.pages));

      const res = await fetch(`/api/books/${id}`, {
        method: "PATCH",
        body: fd,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Ошибка сохранения");
      router.push(`/book/${id}`);
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setSaving(false);
    }
  }

  const input = "w-full rounded-xl border border-stone-300 p-3 text-sm";
  const label = "block text-sm font-medium text-stone-700";

  return (
    <form onSubmit={save} className="mx-auto max-w-xl space-y-4 px-4 py-10" encType="multipart/form-data">
      <h1 className="text-2xl font-extrabold text-stone-900">Редактирование объявления</h1>

      <label className={label}>
        Название
        <input
          className={input}
          name="title"
          value={form.title ?? ""}
          onChange={(e) => set("title", e.target.value)}
          required
        />
      </label>
      <label className={label}>
        Автор
        <input
          className={input}
          name="author"
          value={form.author ?? ""}
          onChange={(e) => set("author", e.target.value)}
        />
      </label>
      <label className={label}>
        Описание
        <textarea
          className={input}
          name="description"
          rows={4}
          value={form.description ?? ""}
          onChange={(e) => set("description", e.target.value)}
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className={label}>
          Категория
          <select
            className={input}
            name="category"
            value={form.category ?? ""}
            onChange={(e) => set("category", e.target.value)}
          >
            {Object.entries(categoryLabels as Record<string, string>).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className={label}>
          Состояние
          <select
            className={input}
            name="condition"
            value={form.condition ?? "used"}
            onChange={(e) => set("condition", e.target.value)}
          >
            <option value="new">Новая</option>
            <option value="used">Б/у</option>
            <option value="annotated">С пометками</option>
          </select>
        </label>
      </div>

      <div className={label}>
        <label htmlFor="genre">Жанр / предмет</label>
        <GenreSelect
          className={input}
          value={form.genre ?? ""}
          onChange={(v) => set("genre", v)}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className={label}>
          Год
          <input
            className={input}
            name="year"
            type="number"
            value={form.year ?? ""}
            onChange={(e) => set("year", e.target.value)}
          />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className={label}>
          Город
          <input
            className={input}
            name="city"
            value={form.city ?? ""}
            onChange={(e) => set("city", e.target.value)}
          />
        </label>
        <label className={label}>
          Корпус / общежитие
          <input
            className={input}
            name="campus"
            value={form.campus ?? ""}
            onChange={(e) => set("campus", e.target.value)}
          />
        </label>
      </div>

      <label className={label}>
        Новая обложка (JPG/PNG/WebP ≤ 5 МБ)
        <input
          className={input}
          name="cover"
          type="file"
          accept="image/jpeg,image/png,image/webp"
        />
      </label>
      {form.coverUrl && (
        <p className="text-xs text-stone-500">
          Текущая:{" "}
          <a href={form.coverUrl} className="text-indigo-600 underline" target="_blank" rel="noreferrer">
            открыть
          </a>
        </p>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {saving ? "Сохранение…" : "Сохранить"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-xl px-5 py-2 text-sm font-medium ring-1 ring-stone-300"
        >
          Отмена
        </button>
      </div>
    </form>
  );
}