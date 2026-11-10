export const instant = false;

import { Suspense } from "react";
import Link from "next/link";
import { FiArrowLeft } from "react-icons/fi";
import BookCard from "@/components/BookCard";
import AuthorInfoCard from "@/components/AuthorInfoCard";
import { LinkButton } from "@/components/Button";
import { listBooks } from "@/lib/books-store";
import type { Book } from "@/data/books";

export default async function AuthorPage({ params }: { params: Promise<{ name: string }> }) {
  const { name: raw } = await params;
  let author = raw;
  try {
    author = decodeURIComponent(raw);
  } catch {
    /* оставляем как есть */
  }

  const { books, total } = await listBooks({ author, limit: 100, sort: "title" });

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <nav className="text-sm text-stone-500">
        <Link href="/catalog" className="hover:text-indigo-600">
          Каталог
        </Link>{" "}
        / Автор
      </nav>

      <h1 className="mt-4 text-3xl font-extrabold text-stone-900">{author}</h1>
      <p className="mt-2 text-stone-500">Книг этого автора в каталоге: {total}</p>

      <div className="mt-8 flex flex-col gap-8 lg:flex-row lg:items-start">
        <div className="min-w-0 empty:hidden lg:order-2 lg:w-[22rem] lg:shrink-0">
          <Suspense fallback={null}>
            <AuthorInfoCard author={author} />
          </Suspense>
        </div>

        <div className="min-w-0 flex-1 lg:order-1">
          {books.length === 0 ? (
            <div className="rounded-2xl bg-white p-12 text-center ring-1 ring-stone-200">
              <p className="font-semibold text-stone-800">Книг этого автора пока нет</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3">
              {books.map((b) => (
                <BookCard key={b.id} book={b as Book} />
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-10">
        <LinkButton href="/catalog" variant="outline">
          <FiArrowLeft /> К каталогу
        </LinkButton>
      </div>
    </div>
  );
}
