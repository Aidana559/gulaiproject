export const instant = false;

import Link from "next/link";
import { notFound } from "next/navigation";
import { categoryLabels, type Book } from "@/data/books";
import { conditionLabels, getBook, type ServerBook } from "@/lib/books-store";
import BookCover from "@/components/BookCover";
import BookCard from "@/components/BookCard";
import BookStatusBadge from "@/components/BookStatusBadge";
import ReserveButton from "@/components/ReserveButton";
import { LinkButton } from "@/components/Button";
import BookActions from "@/components/BookActions";
import OwnerRating from "@/components/OwnerRating";
import ReportButton from "@/components/ReportButton";
import ReviewsSection from "@/components/ReviewsSection";
import BookGuard from "@/components/BookGuard";
import { listBooks } from "@/lib/books-store";
import BookBorrowers from "@/components/BookBorrowers";
import { FiArrowLeft } from "react-icons/fi";


export default async function BookPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const book = (await getBook(id, { includeHidden: true })) as ServerBook | undefined;
  if (!book || book.deleted) notFound();
  // скрытые отдаём только через API с правами; на SSR для простоты 404 гостю
  if (book.hidden) notFound();

  const ownerKey = String(book.ownerId ?? book.owner);

  const similarRes = await listBooks({
    category: book.category,
    limit: 8,
    sort: "popular",
  });
  const similar = similarRes.books.filter((b) => String(b.id) !== String(book.id)).slice(0, 4);

  const condition =
    book.condition && conditionLabels[book.condition]
      ? conditionLabels[book.condition]
      : null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <BookGuard bookId={book.id} />

      <nav className="text-sm text-stone-500">
        <Link href="/catalog" className="hover:text-indigo-600">
          Каталог
        </Link>{" "}
        / {categoryLabels[book.category]}
      </nav>

      <div className="mt-6 grid gap-10 lg:grid-cols-[20rem_1fr]">
        <BookCover book={book as Book} large />

        <div>
          <BookStatusBadge book={book as Book} />
          <h1 className="mt-3 text-3xl font-extrabold text-stone-900">{book.title}</h1>
          <p className="mt-1 text-lg">
            <Link
              href={`/author/${encodeURIComponent(book.author)}`}
              className="text-stone-500 hover:text-indigo-600 hover:underline"
            >
              {book.author}
            </Link>
          </p>
          {book.description && <p className="mt-6 text-stone-700">{book.description}</p>}

          <dl className="mt-6 grid grid-cols-2 gap-4 rounded-2xl bg-white p-5 ring-1 ring-stone-200 sm:grid-cols-3 lg:grid-cols-4">
            <div>
              <dt className="text-xs text-stone-400">Категория</dt>
              <dd className="font-medium">{categoryLabels[book.category]}</dd>
            </div>
            <div>
              <dt className="text-xs text-stone-400">Жанр / предмет</dt>
              <dd className="font-medium">
                {book.genre && book.genre !== "—" ? (
                  <Link
                    href={`/catalog?genre=${encodeURIComponent(book.genre)}`}
                    className="text-indigo-700 hover:underline"
                  >
                    {book.genre}
                  </Link>
                ) : (
                  "—"
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-stone-400">Год</dt>
              <dd className="font-medium">
                {book.year ? (
                  <Link href={`/catalog?year=${book.year}`} className="text-indigo-700 hover:underline">
                    {book.year}
                  </Link>
                ) : (
                  "—"
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-stone-400">Страниц</dt>
              <dd className="font-medium">{book.pages || "—"}</dd>
            </div>
            {condition && (
              <div>
                <dt className="text-xs text-stone-400">Состояние</dt>
                <dd className="font-medium">{condition}</dd>
              </div>
            )}
            {book.campus && (
              <div>
                <dt className="text-xs text-stone-400">Корпус / общ.</dt>
                <dd className="font-medium">{book.campus}</dd>
              </div>
            )}
            <div>
              <dt className="text-xs text-stone-400">Просмотры</dt>
              <dd className="font-medium">{book.views ?? 0}</dd>
            </div>
          </dl>

          <div className="mt-6 flex items-center gap-3 text-sm text-stone-600">
            <span className="flex size-10 items-center justify-center rounded-full bg-indigo-100 font-bold text-indigo-700">
              {(book.owner || "?")[0]}
            </span>
            <div>
              <p className="font-medium text-stone-900">{book.owner}</p>
              <p className="text-stone-500">
                {[book.city, book.campus].filter(Boolean).join(" · ")}
              </p>
              <div className="mt-1">
                <OwnerRating userId={ownerKey} />
              </div>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <ReserveButton book={book as Book} ownerKey={ownerKey} />
            <LinkButton href="/catalog" variant="outline" size="lg">
              <FiArrowLeft /> К каталогу
            </LinkButton>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-4">
            <BookActions bookId={book.id} ownerId={ownerKey} />
            <ReportButton bookId={book.id} />
          </div>
        </div>
      </div>

      <BookBorrowers bookId={Number(book.id)} ownerKey={ownerKey} />

      <ReviewsSection bookId={book.id} ownerId={ownerKey} />

      {similar.length > 0 && (
        <section className="mt-16">
          <h2 className="text-xl font-bold text-stone-900">Похожие издания</h2>
          <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {similar.map((b) => (
              <BookCard key={b.id} book={b as Book} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}