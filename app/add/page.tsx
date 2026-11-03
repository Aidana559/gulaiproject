"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { addBook } from "@/lib/bookStore";
import { Button } from "@/components/Button";
import { inputClass } from "@/components/FormField";
import type { Category } from "@/data/books";

export default function AddPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const fd = new FormData(e.currentTarget);
    const title = String(fd.get("title") ?? "").trim();
    const author = String(fd.get("author") ?? "").trim();
    const category = String(fd.get("category") ?? "book") as Category;
    const genre = String(fd.get("genre") ?? "").trim();
    const yearRaw = String(fd.get("year") ?? "");
    const city = String(fd.get("city") ?? "").trim();
    const description = String(fd.get("description") ?? "").trim();

    if (title.length < 2) {
      setError("Укажите название");
      setLoading(false);
      return;
    }
    if (author.length < 2) {
      setError("Укажите автора");
      setLoading(false);
      return;
    }

    try {
      const book = addBook({
        title,
        author,
        category,
        genre,
        year: yearRaw ? Number(yearRaw) : undefined,
        city,
        description,
        owner: user?.name ?? "Вы",
      });

      await fetch("/api/books", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(book),
      }).catch(() => {});

      setDone(true);
      setTimeout(() => router.push("/catalog"), 900);
    } catch {
      setError("Не удалось сохранить");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-extrabold text-stone-900">Добавить издание</h1>
      <p className="mt-2 text-stone-500">
        Заполните форму — объявление сразу появится в каталоге.
      </p>

      <form
        onSubmit={onSubmit}
        className="mt-8 space-y-5 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-stone-200"
      >
        <div>
          <label htmlFor="title" className="mb-1.5 block text-sm font-medium text-stone-700">
            Название
          </label>
          <input
            id="title"
            name="title"
            required
            minLength={2}
            placeholder="Например: Хвост Феи"
            className={inputClass}
            defaultValue=""
          />
        </div>

        <div>
          <label htmlFor="author" className="mb-1.5 block text-sm font-medium text-stone-700">
            Автор
          </label>
          <input id="author" name="author" required minLength={2} className={inputClass} />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="category" className="mb-1.5 block text-sm font-medium text-stone-700">
              Категория
            </label>
            <select id="category" name="category" className={inputClass} defaultValue="book">
              <option value="book">Книга</option>
              <option value="textbook">Учебник</option>
              <option value="guide">Методичка</option>
              <option value="manga">Манга</option>
            </select>
          </div>
          <div>
            <label htmlFor="genre" className="mb-1.5 block text-sm font-medium text-stone-700">
              Жанр / предмет
            </label>
            <input id="genre" name="genre" placeholder="сёнэн, фэнтези…" className={inputClass} />
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="year" className="mb-1.5 block text-sm font-medium text-stone-700">
              Год издания
            </label>
            <input id="year" name="year" type="number" min={1900} max={2030} className={inputClass} />
          </div>
          <div>
            <label htmlFor="city" className="mb-1.5 block text-sm font-medium text-stone-700">
              Город
            </label>
            <input id="city" name="city" placeholder="Актау, Астана…" className={inputClass} />
          </div>
        </div>

        <div>
          <label htmlFor="description" className="mb-1.5 block text-sm font-medium text-stone-700">
            Описание
          </label>
          <textarea id="description" name="description" rows={4} className={inputClass} />
        </div>

        <div>
          <label htmlFor="cover" className="mb-1.5 block text-sm font-medium text-stone-700">
            Обложка
          </label>
          <input
            id="cover"
            name="cover"
            type="file"
            accept="image/*"
            className={`${inputClass} file:mr-4 file:rounded-md file:border-0 file:bg-indigo-50 file:px-3 file:py-1.5 file:font-semibold file:text-indigo-700 hover:file:bg-indigo-100`}
          />
          <p className="mt-1 text-xs text-stone-400">
            Пока без загрузки на сервер — обложка рисуется автоматически.
          </p>
        </div>

        {error && (
          <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
        {done && (
          <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700 ring-1 ring-emerald-200">
            ✅ Объявление опубликовано! Переходим в каталог…
          </p>
        )}

        <Button type="submit" size="lg" full disabled={loading || done}>
          {loading ? "Публикация…" : done ? "Готово" : "Опубликовать"}
        </Button>
      </form>
    </div>
  );
}
