import type { Book } from "@/data/books";
import { categoryEmoji } from "@/data/books";

type BookWithCover = Book & { coverUrl?: string | null };

/** Обложка: фото из /uploads или CSS-градиент */
export default function BookCover({
  book,
  large = false,
}: {
  book: BookWithCover;
  large?: boolean;
}) {
  if (book.coverUrl) {
    return (
      <div
        className={`relative aspect-[3/4] w-full overflow-hidden rounded-lg shadow-md ${
          large ? "max-w-xs" : ""
        }`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={book.coverUrl}
          alt={book.title}
          className="h-full w-full object-cover"
        />
      </div>
    );
  }

  return (
    <div
      className={`relative flex aspect-[3/4] w-full flex-col justify-between overflow-hidden rounded-lg bg-gradient-to-br ${book.gradient} p-4 text-white shadow-md ${
        large ? "max-w-xs" : ""
      }`}
    >
      <div className="absolute inset-y-0 left-0 w-2 bg-black/20" />
      <span className="text-2xl drop-shadow">{categoryEmoji[book.category]}</span>
      <div className="pl-2">
        <p className={`${large ? "text-2xl" : "text-base"} font-bold leading-tight drop-shadow`}>
          {book.title}
        </p>
        <p className={`${large ? "text-sm" : "text-xs"} mt-2 opacity-90`}>{book.author}</p>
      </div>
    </div>
  );
}
