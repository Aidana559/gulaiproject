import Link from "next/link";
import type { Book } from "@/data/books";
import { categoryLabels } from "@/data/books";
import BookCover from "./BookCover";
import BookStatusBadge from "./BookStatusBadge";
import { LinkButton } from "./Button";

export default function BookCard({ book }: { book: Book }) {
  return (
    <article className="group flex flex-col rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-200 transition hover:-translate-y-1 hover:shadow-lg">
      <Link href={`/book/${book.id}`} aria-label={book.title}>
        <BookCover book={book} />
      </Link>
      <div className="mt-4 flex flex-1 flex-col">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-indigo-600">
            {categoryLabels[book.category]}
          </span>
          <BookStatusBadge book={book} />
        </div>
        <h3 className="mt-2 line-clamp-2 font-semibold text-stone-900">{book.title}</h3>
        <p className="mt-1 text-sm text-stone-500">{book.author}</p>
        <p className="mt-1 text-xs text-stone-400">
          {book.genre} · {book.city}
        </p>
        <div className="mt-4 flex-1" />
        <LinkButton href={`/book/${book.id}`} variant="outline" size="sm" full>
          Подробнее
        </LinkButton>
      </div>
    </article>
  );
}