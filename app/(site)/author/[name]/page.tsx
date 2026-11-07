export const instant = false;

import Link from "next/link";
import { FiArrowLeft } from "react-icons/fi";
import BookCard from "@/components/BookCard";
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

      {books.length === 0 ? (
        <div className="mt-10 rounded-2xl bg-white p-12 text-center ring-1 ring-stone-200">
          <p className="font-semibold text-stone-800">Книг этого автора пока нет</p>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {books.map((b) => (
            <BookCard key={b.id} book={b as Book} />
          ))}
        </div>
      )}

      <div className="mt-10">
        <LinkButton href="/catalog" variant="outline">
          <FiArrowLeft /> К каталогу
        </LinkButton>
      </div>
    </div>
  );
}
