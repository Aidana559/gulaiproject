"use client";

import GenreMultiSelect from "@/components/GenreMultiSelect";
import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { useTaxonomy } from "@/components/TaxonomyProvider";

type Form = {
  title?: string;
  author?: string;
  description?: string;
  genres?: string[];
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
  const { categories } = useTaxonomy();
  // подписка: подписи категорий обновляются, когда администратор их меняет
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [form, setForm] = useState<Form | null>(null);
  const [ownerId, setOwnerId] = useState<string>("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

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
          genres:
            Array.isArray(b.genres) && b.genres.length
              ? b.genres
              : b.genre && b.genre !== "—"
                ? [b.genre]
                : [],
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
  const setGenres = (genres: string[]) => setForm({ ...form, genres });

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (savingRef.current || saving) return;

    const titleVal = String(form!.title ?? "").trim();
    const authorVal = String(form!.author ?? "").trim();
    const descVal = String(form!.description ?? "").trim();
    if (titleVal.length < 2) {
      setError("Название не может быть короче 2 символов");
      return;
    }
    if (titleVal.length > 200) {
      setError("Название слишком длинное (макс. 200 символов)");
      return;
    }
    if (authorVal.length < 2) {
      setError("Автор не может быть короче 2 символов");
      return;
    }
    if (authorVal.length > 200) {
      setError("Имя автора слишком длинное (макс. 200 символов)");
      return;
    }
    if (descVal.length > 5000) {
      setError("Описание слишком длинное (макс. 5000 символов)");
      return;
    }
    if (form!.year !== undefined && form!.year !== "") {
      const y = Number(form!.year);
      if (!Number.isFinite(y) || y < 1000 || y > new Date().getFullYear() + 1) {
        setError("Некорректный год издания");
        return;
      }
    }
    if (form!.pages !== undefined && form!.pages !== "") {
      const p = Number(form!.pages);
      if (!Number.isFinite(p) || p < 0 || p > 100_000) {
        setError("Некорректное число страниц");
        return;
      }
    }

    setError("");
    setSuccess("");
    savingRef.current = true;
    setSaving(true);
    try {
      const fd = new FormData(e.currentTarget);
      fd.set("title", titleVal);
      fd.set("author", authorVal);
      fd.set("description", descVal);
      // жанры: берём из состояния формы (можно добавлять и удалять, повторы отсекает сервер)
      fd.delete("genres");
      for (const g of form!.genres ?? []) fd.append("genres", g);
      fd.set("genresPresent", "1");
      fd.set("category", form!.category ?? "book");
      fd.set("city", form!.city ?? "");
      fd.set("campus", form!.campus ?? "");
      fd.set("condition", form!.condition ?? "used");
      if (form!.year !== undefined && form!.year !== "") fd.set("year", String(form!.year));
      if (form!.pages !== undefined && form!.pages !== "") fd.set("pages", String(form!.pages));

      const res = await fetch(`/api/books/${id}`, {
        method: "PATCH",
        body: fd,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Ошибка сохранения");
      // успех без полной перезагрузки: сообщение, затем переход
      setSuccess(json.message ?? "Изменения сохранены");
      setTimeout(() => {
        router.push(`/book/${id}`);
        router.refresh();
      }, 600);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Ошибка");
      savingRef.current = false;
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
          minLength={2}
          maxLength={200}
        />
      </label>
      <label className={label}>
        Автор
        <input
          className={input}
          name="author"
          value={form.author ?? ""}
          onChange={(e) => set("author", e.target.value)}
          required
          minLength={2}
          maxLength={200}
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
            {categories.map((c) => (
              <option key={c.key} value={c.key}>
                {c.singular}
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
        <label htmlFor="genres">Жанры / предметы (можно несколько)</label>
        <GenreMultiSelect className={input} value={form.genres ?? []} onChange={setGenres} />
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

      {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
      {success && <p className="text-sm text-emerald-700" role="status">{success}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving || !!success}
          className="rounded-xl bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {saving ? "Сохранение…" : success ? "Сохранено" : "Сохранить"}
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