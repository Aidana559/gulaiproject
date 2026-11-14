import type { Book } from "@/data/books";
import CategoryIcon from "./CategoryIcon";

type BookWithCover = Book & { coverUrl?: string | null };

/** Обложка: фото из /uploads или CSS-градиент */
export default function BookCover({
  book,
  large = false,
  compact = false,
}: {
  book: BookWithCover;
  large?: boolean;
  /** маленькая обложка для горизонтальных карточек каталога */
  compact?: boolean;
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
      className={`relative flex aspect-[3/4] w-full flex-col justify-between overflow-hidden rounded-lg bg-gradient-to-br ${book.gradient} text-white shadow-md ${
        compact ? "p-2" : "p-4"
      } ${large ? "max-w-xs" : ""}`}
    >
      <div className="absolute inset-y-0 left-0 w-2 bg-black/20" />
      <CategoryIcon category={book.category} className={compact ? "text-lg drop-shadow" : "text-2xl drop-shadow"} />
      <div className="pl-2">
        <p
          className={`${large ? "text-2xl" : compact ? "line-clamp-4 text-[11px]" : "text-base"} font-bold leading-tight drop-shadow`}
        >
          {book.title}
        </p>
        <p className={`${large ? "text-sm" : compact ? "line-clamp-1 text-[10px]" : "text-xs"} mt-1 opacity-90`}>
          {book.author}
        </p>
      </div>
    </div>
  );
}
