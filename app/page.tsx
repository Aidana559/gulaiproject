import Link from "next/link";
import { books, categoryEmoji, categoryLabels, type Category } from "@/data/books";
import BookCard from "@/components/BookCard";
import { LinkButton } from "@/components/Button";

const cats = Object.keys(categoryLabels) as Category[];

const steps = [
  { n: "1", title: "Зарегистрируйтесь", text: "Создайте профиль за минуту." },
  { n: "2", title: "Найдите или добавьте книгу", text: "Ищите по названию, автору и жанру или выложите свою." },
  { n: "3", title: "Забронируйте", text: "Договоритесь о встрече с владельцем." },
  { n: "4", title: "Оставьте отзыв", text: "Поделитесь впечатлением о прочитанном." },
];

export default function Home() {
  const popular = books.filter((b) => b.status === "available").slice(0, 8);

  return (
    <>
      {/* Hero */}
      <section className="bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-800 text-white">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
          <p className="inline-block rounded-full bg-white/15 px-4 py-1 text-sm font-medium">
            📚 Платформа студенческого буккроссинга
          </p>
          <h1 className="mt-6 max-w-3xl text-4xl font-extrabold tracking-tight sm:text-6xl">
            Читай, обменивайся, делись знаниями
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-indigo-100">
            Книги, учебники, методички и манга — всё это можно взять у других студентов и отдать
            свои, которые уже прочитаны.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <LinkButton href="/catalog" variant="secondary" size="lg">
              Открыть каталог
            </LinkButton>
            <LinkButton
              href="/add"
              variant="outline"
              size="lg"
              className="!bg-transparent !text-white !ring-white/50 hover:!bg-white/10"
            >
              Добавить книгу
            </LinkButton>
          </div>
          <dl className="mt-14 grid max-w-xl grid-cols-3 gap-6">
            <div><dt className="text-sm text-indigo-200">Изданий</dt><dd className="text-3xl font-bold">{books.length}</dd></div>
            <div><dt className="text-sm text-indigo-200">Категорий</dt><dd className="text-3xl font-bold">{cats.length}</dd></div>
            <div><dt className="text-sm text-indigo-200">Городов</dt><dd className="text-3xl font-bold">5</dd></div>
          </dl>
        </div>
      </section>

      {/* Категории */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <h2 className="text-2xl font-bold text-stone-900 sm:text-3xl">Категории</h2>
        <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {cats.map((c) => (
            <Link
              key={c}
              href={`/catalog?category=${c}`}
              className="rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-stone-200 transition hover:-translate-y-1 hover:shadow-lg"
            >
              <p className="text-4xl">{categoryEmoji[c]}</p>
              <p className="mt-3 font-semibold text-stone-900">{categoryLabels[c]}</p>
              <p className="text-sm text-stone-500">{books.filter((b) => b.category === c).length} шт.</p>
            </Link>
          ))}
        </div>
      </section>

      {/* Свежие */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between">
          <h2 className="text-2xl font-bold text-stone-900 sm:text-3xl">Доступно сейчас</h2>
          <LinkButton href="/catalog" variant="ghost">Весь каталог →</LinkButton>
        </div>
        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {popular.map((b) => (
            <BookCard key={b.id} book={b} />
          ))}
        </div>
      </section>

      {/* Как это работает */}
      <section className="mx-auto mt-20 max-w-7xl px-4 sm:px-6 lg:px-8">
        <h2 className="text-center text-2xl font-bold text-stone-900 sm:text-3xl">Как это работает</h2>
        <ol className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s) => (
            <li key={s.n} className="rounded-2xl bg-white p-6 ring-1 ring-stone-200">
              <span className="flex size-10 items-center justify-center rounded-full bg-indigo-100 font-bold text-indigo-700">
                {s.n}
              </span>
              <h3 className="mt-4 font-semibold text-stone-900">{s.title}</h3>
              <p className="mt-1 text-sm text-stone-500">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* CTA */}
      <section className="mx-auto mt-20 max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="rounded-3xl bg-amber-100 px-6 py-14 text-center">
          <h2 className="text-2xl font-bold text-stone-900 sm:text-3xl">Есть ненужные книги или конспекты?</h2>
          <p className="mx-auto mt-3 max-w-xl text-stone-600">
            Отдайте их тому, кому они нужны прямо сейчас.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <LinkButton href="/register" size="lg">Присоединиться</LinkButton>
            <LinkButton href="/add" variant="outline" size="lg">Добавить книгу</LinkButton>
          </div>
        </div>
      </section>
    </>
  );
}