import Link from "next/link";
import { notFound } from "next/navigation";
import { books, categoryLabels, getBook } from "@/data/books";
import BookCover from "@/components/BookCover";
import BookCard from "@/components/BookCard";
import BookStatusBadge from "@/components/BookStatusBadge";
import ReserveButton from "@/components/ReserveButton";
import DemoForm from "@/components/DemoForm";
import { SelectField, TextArea } from "@/components/FormField";
import { LinkButton } from "@/components/Button";

export function generateStaticParams() {
  return books.map((b) => ({ id: String(b.id) }));
}

const reviews = [
  { name: "Алина Н.", rating: 5, text: "Отличное состояние, владелец вежливый. Передали в университете." },
  { name: "Тимур Ж.", rating: 4, text: "Всё хорошо, небольшие следы от карандаша на полях." },
];

export default async function BookPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const book = getBook(Number(id));
  if (!book) notFound();

  const similar = books.filter((b) => b.category === book.category && b.id !== book.id).slice(0, 4);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <nav className="text-sm text-stone-500">
        <Link href="/catalog" className="hover:text-indigo-600">Каталог</Link> / {categoryLabels[book.category]}
      </nav>

      <div className="mt-6 grid gap-10 lg:grid-cols-[20rem_1fr]">
        <BookCover book={book} large />

        <div>
          <BookStatusBadge book={book} />
          <h1 className="mt-3 text-3xl font-extrabold text-stone-900">{book.title}</h1>
          <p className="mt-1 text-lg text-stone-500">{book.author}</p>
          <p className="mt-6 text-stone-700">{book.description}</p>

          <dl className="mt-6 grid grid-cols-2 gap-4 rounded-2xl bg-white p-5 ring-1 ring-stone-200 sm:grid-cols-4">
            <div><dt className="text-xs text-stone-400">Категория</dt><dd className="font-medium">{categoryLabels[book.category]}</dd></div>
            <div><dt className="text-xs text-stone-400">Жанр / предмет</dt><dd className="font-medium">{book.genre}</dd></div>
            <div><dt className="text-xs text-stone-400">Год</dt><dd className="font-medium">{book.year}</dd></div>
            <div><dt className="text-xs text-stone-400">Страниц</dt><dd className="font-medium">{book.pages}</dd></div>
          </dl>

          <div className="mt-6 flex items-center gap-3 text-sm text-stone-600">
            <span className="flex size-10 items-center justify-center rounded-full bg-indigo-100 font-bold text-indigo-700">
              {book.owner[0]}
            </span>
            <div>
              <p className="font-medium text-stone-900">{book.owner}</p>
              <p className="text-stone-500">{book.city}</p>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <ReserveButton book={book} />
            <LinkButton href="/catalog" variant="outline" size="lg">← К каталогу</LinkButton>
          </div>
        </div>
      </div>

      {/* Отзывы */}
      <section className="mt-16 grid gap-10 lg:grid-cols-2">
        <div>
          <h2 className="text-xl font-bold text-stone-900">Отзывы</h2>
          <ul className="mt-4 space-y-4">
            {reviews.map((r) => (
              <li key={r.name} className="rounded-2xl bg-white p-5 ring-1 ring-stone-200">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-stone-900">{r.name}</p>
                  <p className="text-amber-500" aria-label={`Оценка ${r.rating} из 5`}>
                    {"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}
                  </p>
                </div>
                <p className="mt-2 text-sm text-stone-600">{r.text}</p>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="text-xl font-bold text-stone-900">Оставить отзыв</h2>
          <div className="mt-4 rounded-2xl bg-white p-5 ring-1 ring-stone-200">
            <DemoForm submitLabel="Отправить отзыв" successMessage="Спасибо! Отзыв отправлен на проверку.">
              <SelectField label="Оценка" id="rating">
                {[5, 4, 3, 2, 1].map((n) => (
                  <option key={n} value={n}>{"★".repeat(n)}</option>
                ))}
              </SelectField>
              <TextArea label="Ваш отзыв" id="text" />
            </DemoForm>
          </div>
        </div>
      </section>

      {similar.length > 0 && (
        <section className="mt-16">
          <h2 className="text-xl font-bold text-stone-900">Похожие издания</h2>
          <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {similar.map((b) => <BookCard key={b.id} book={b} />)}
          </div>
        </section>
      )}
    </div>
  );
}