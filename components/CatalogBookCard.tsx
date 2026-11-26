import UserLink from "@/components/UserLink";
import Link from "next/link";
import { categoryLabels, type Book } from "@/data/books";
import { genresOf } from "@/lib/genres";
import BookCover from "./BookCover";
import BookStatusBadge from "./BookStatusBadge";


export default function CatalogBookCard({ book }: { book: Book }) {
  const genres = genresOf(book);
  const meta = [book.year ? `${book.year} г.` : null, book.city && book.city !== "—" ? book.city : null]
    .filter(Boolean)
    .join(" · ");

  const ownerId = (book as Book & { ownerId?: string | number }).ownerId;
  return (
    <article className="group relative flex min-h-[15rem] gap-5 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-stone-200 transition hover:-translate-y-0.5 hover:shadow-lg">
      <Link href={`/book/${book.id}`} aria-label={book.title} className="w-[6.5rem] shrink-0 self-start">
        <BookCover book={book} compact />
      </Link>

      <div className="flex min-w-0 flex-1 flex-col">
        <h3 className="line-clamp-3 text-lg font-bold leading-snug text-stone-900">
          <Link href={`/book/${book.id}`} className="after:absolute after:inset-0 hover:text-indigo-700">
            {book.title}
          </Link>
        </h3>

        <p className="mt-1 line-clamp-2 text-sm">
          <Link
            href={`/author/${encodeURIComponent(book.author)}`}
            className="relative z-10 text-stone-500 hover:text-indigo-600 hover:underline"
          >
            {book.author}
          </Link>
        </p>

        <p className="mt-2 line-clamp-2 text-xs text-stone-400">
          <span className="font-medium uppercase tracking-wide text-indigo-600">{categoryLabels[book.category]}</span>
          {genres.length > 0 && ` · ${genres.join(", ")}`}
        </p>

        {ownerId != null && <p className="relative z-10 mt-2 text-xs text-stone-500">Владелец: <UserLink userId={ownerId}>{book.owner}</UserLink></p>}
        <div className="mt-3">
          <BookStatusBadge book={book} />
        </div>

        {meta && <p className="mt-auto pt-3 text-sm text-stone-500">{meta}</p>}
      </div>
    </article>
  );
}
