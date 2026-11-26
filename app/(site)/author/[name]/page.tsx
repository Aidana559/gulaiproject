export const instant = false;

import { Suspense } from "react";
import Link from "next/link";
import { FiArrowLeft } from "react-icons/fi";
import BookCard from "@/components/BookCard";
import AuthorProfile, { AuthorHeadingOnly } from "@/components/AuthorProfile";
import { LinkButton } from "@/components/Button";
import { listBooks } from "@/lib/books-store";
import { splitAuthors } from "@/lib/author-info";
import type { Book } from "@/data/books";

export default async function AuthorPage({ params }: { params: Promise<{ name: string }> }) {
  const { name: raw } = await params;
  let author = raw;
  try {
    author = decodeURIComponent(raw);
  } catch {
    /* оставляем как есть */
  }

  const people = splitAuthors(author);
  const { books, total } = await listBooks({ author, limit: 100, sort: "title" });

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <nav className="text-sm text-stone-500">
        <Link href="/catalog" className="hover:text-indigo-600">
          Каталог
        </Link>{" "}
        / Автор
      </nav>

      {/* Имя автора, под ним справка из Википедии, ниже — его книги.
          Если в поле несколько авторов («А, Б, В») — справка про каждого отдельно. */}
      {people.length <= 1 ? (
        <Suspense
          fallback={
            <div className="mt-4">
              <AuthorHeadingOnly name={author} total={total} />
              <div className="mt-4 h-40 animate-pulse rounded-2xl bg-stone-100" aria-hidden />
              <p className="mt-3 text-sm text-stone-400">Загружаем сведения об авторе…</p>
            </div>
          }
        >
          <AuthorProfile author={author} total={total} books={books} />
        </Suspense>
      ) : (
        <>
          <AuthorHeadingOnly name={author} total={total} />
          <div className="mt-6 grid gap-5 lg:grid-cols-2">
            {people.map((p) => (
              <Suspense
                key={p}
                fallback={
                  <div className="rounded-2xl bg-white p-5 ring-1 ring-stone-200">
                    <div className="h-8 w-2/3 animate-pulse rounded bg-stone-100" />
                    <div className="mt-3 h-24 animate-pulse rounded bg-stone-100" />
                    <p className="mt-3 text-sm text-stone-400">Загружаем сведения…</p>
                  </div>
                }
              >
                <AuthorProfile author={p} member books={books} />
              </Suspense>
            ))}
          </div>
        </>
      )}

      <section className="mt-10" aria-label="Книги автора">
        <h2 className="text-2xl font-bold text-stone-900">Книги</h2>
        {books.length === 0 ? (
          <div className="mt-5 rounded-2xl bg-white p-12 text-center ring-1 ring-stone-200">
            <p className="font-semibold text-stone-800">Книг этого автора пока нет</p>
          </div>
        ) : (
          <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {books.map((b) => (
              <BookCard key={b.id} book={b as Book} />
            ))}
          </div>
        )}
      </section>

      <div className="mt-10">
        <LinkButton href="/catalog" variant="outline">
          <FiArrowLeft /> К каталогу
        </LinkButton>
      </div>
    </div>
  );
}
