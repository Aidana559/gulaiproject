"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/Button";
import { inputClass } from "@/components/FormField";
import GenreSelect from "@/components/GenreSelect";
import GoogleBookSearch, { type GoogleBookHit } from "@/components/GoogleBookSearch";
import { FiCheckCircle } from "react-icons/fi";
import type { Category } from "@/data/books";

export default function AddPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [createdId, setCreatedId] = useState<number | string | null>(null);
  const [genre, setGenre] = useState("");
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [year, setYear] = useState("");
  const [pages, setPages] = useState("");
  const [description, setDescription] = useState("");
  const [coverUrl, setCoverUrl] = useState("");

  function fillFromGoogle(b: GoogleBookHit) {
    setTitle(b.title);
    setAuthor(b.author);
    setYear(b.year ? String(b.year) : "");
    setPages(b.pages ? String(b.pages) : "");
    setDescription(b.description.slice(0, 1000));
    setCoverUrl(b.cover);
  }

  if (!authLoading && !user) {
    if (typeof window !== "undefined") router.replace("/login");
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!user) {
      router.push("/login");
      return;
    }
    setError("");
    setLoading(true);

    const form = e.currentTarget;
    const fd = new FormData(form);

    const titleVal = String(fd.get("title") ?? "").trim();
    const authorVal = String(fd.get("author") ?? "").trim();
    if (titleVal.length < 2) {
      setError("Укажите название");
      setLoading(false);
      return;
    }
    if (authorVal.length < 2) {
      setError("Укажите автора");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/books", {
        method: "POST",
        body: fd, // multipart: поля + cover
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "Не удалось сохранить");
        setLoading(false);
        return;
      }
      setCreatedId(json.book?.id ?? null);
      setDone(true);
      setTimeout(() => {
        if (json.book?.id) router.push(`/book/${json.book.id}`);
        else router.push("/catalog");
      }, 800);
    } catch {
      setError("Нет связи с сервером");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-extrabold text-stone-900">Добавить издание</h1>
      <p className="mt-2 text-stone-500">
        Объявление сохранится на сервере и сразу появится в каталоге.
      </p>

      <form
        onSubmit={onSubmit}
        className="mt-8 space-y-5 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-stone-200"
        encType="multipart/form-data"
      >
        <GoogleBookSearch onPick={fillFromGoogle} />
        <input type="hidden" name="coverUrl" value={coverUrl} />
        <input type="hidden" name="pages" value={pages} />

        <div>
          <label htmlFor="title" className="mb-1.5 block text-sm font-medium text-stone-700">
            Название
          </label>
          <input
            id="title"
            name="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            minLength={2}
            placeholder="Например: Хвост Феи"
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="author" className="mb-1.5 block text-sm font-medium text-stone-700">
            Автор
          </label>
          <input
            id="author"
            name="author"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            required
            minLength={2}
            className={inputClass}
          />
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
            <GenreSelect value={genre} onChange={setGenre} />
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="year" className="mb-1.5 block text-sm font-medium text-stone-700">
              Год издания
            </label>
            <input
              id="year"
              name="year"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              type="number"
              min={1900}
              max={2030}
              placeholder="2020"
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="condition" className="mb-1.5 block text-sm font-medium text-stone-700">
              Состояние
            </label>
            <select id="condition" name="condition" className={inputClass} defaultValue="used">
              <option value="new">Новая</option>
              <option value="used">Б/у</option>
              <option value="annotated">С пометками</option>
            </select>
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="city" className="mb-1.5 block text-sm font-medium text-stone-700">
              Город
            </label>
            <input id="city" name="city" placeholder="Астана" className={inputClass} />
          </div>
          <div>
            <label htmlFor="campus" className="mb-1.5 block text-sm font-medium text-stone-700">
              Корпус / общежитие
            </label>
            <input
              id="campus"
              name="campus"
              placeholder="Главный корпус, общ. №3…"
              className={inputClass}
            />
          </div>
        </div>

        <div>
          <label htmlFor="description" className="mb-1.5 block text-sm font-medium text-stone-700">
            Описание
          </label>
          <textarea
            id="description"
            name="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="cover" className="mb-1.5 block text-sm font-medium text-stone-700">
            Обложка (JPG, PNG, WebP ≤ 5 МБ)
          </label>
          {coverUrl && (
            <div className="mb-2 flex items-center gap-3 text-xs text-stone-500">
              { }
              <img src={coverUrl} alt="" className="h-16 w-11 rounded object-cover" />
              <span>Обложка из Google Books. Загрузите свой файл ниже, чтобы заменить.</span>
              <button type="button" onClick={() => setCoverUrl("")} className="text-rose-600 underline">
                убрать
              </button>
            </div>
          )}
          <input
            id="cover"
            name="cover"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className={`${inputClass} file:mr-4 file:rounded-md file:border-0 file:bg-indigo-50 file:px-3 file:py-1.5 file:font-semibold file:text-indigo-700 hover:file:bg-indigo-100`}
          />
        </div>

        {error && (
          <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
        {done && (
          <p role="status" className="flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700 ring-1 ring-emerald-200">
            <FiCheckCircle className="shrink-0" /> Объявление опубликовано
            {createdId != null ? ` (#${createdId})` : ""}! Открываем страницу…
          </p>
        )}

        <Button type="submit" size="lg" full disabled={loading || done || !user}>
          {loading ? "Публикация…" : done ? "Готово" : "Опубликовать"}
        </Button>
        {!user && !authLoading && (
          <p className="text-center text-sm text-stone-500">
            Нужно <a href="/login" className="text-indigo-600 underline">войти</a>, чтобы добавить книгу
          </p>
        )}
      </form>
    </div>
  );
}