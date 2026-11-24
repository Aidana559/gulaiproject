import { Suspense } from "react";
import Link from "next/link";
import { FiArrowRight, FiBookOpen } from "react-icons/fi";
import CategoryIcon from "@/components/CategoryIcon";
import UserOnly from "@/components/UserOnly";
import { getTaxonomy } from "@/lib/taxonomy-store";
import { getAllBooks } from "@/lib/books-store";
import { getBookStates } from "@/lib/bookings";
import BookCard from "@/components/BookCard";
import { LinkButton } from "@/components/Button";


const tones = [
  "from-indigo-700 to-indigo-950",
  "from-stone-700 to-stone-900",
  "from-indigo-600 to-stone-800",
  "from-stone-600 to-indigo-900",
];

const steps = [
  { n: "1", title: "Зарегистрируйтесь", text: "Создайте профиль за минуту." },
  { n: "2", title: "Найдите или добавьте книгу", text: "Ищите по названию, автору и жанру или выложите свою." },
  { n: "3", title: "Забронируйте", text: "Договоритесь о встрече с владельцем." },
  { n: "4", title: "Оставьте отзыв", text: "Поделитесь впечатлением о прочитанном." },
];

export default function Home() {
  return (
    <Suspense fallback={<p className="px-4 py-20 text-center text-stone-500">Загрузка…</p>}>
      <HomeContent />
    </Suspense>
  );
}

async function HomeContent() {
  const [books, states] = await Promise.all([getAllBooks(), getBookStates()]);
  const taxonomy = await getTaxonomy();
  const cats = taxonomy.categories;
  
  const popular = books.filter((b) => !states[String(b.id)]).slice(0, 8);

  return (
    <>
      {/* Hero */}
      <section className="px-3 pt-2 sm:px-6 lg:px-8">
        <div className="hero-bg relative mx-auto max-w-7xl overflow-hidden rounded-[2rem] text-white">
          <div className="grid items-center gap-10 px-6 py-16 sm:px-12 lg:grid-cols-[1.5fr_1fr] lg:py-28">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1 text-sm font-medium ring-1 ring-white/20 backdrop-blur">
                <FiBookOpen /> Платформа студенческого буккроссинга
              </p>
              <h1 className="mt-6 max-w-2xl text-5xl leading-[1.05] sm:text-7xl">
                Читай, обменивайся, делись знаниями
              </h1>
              <p className="mt-6 max-w-md text-base text-stone-200">
                Книги, учебники, методички и манга — всё это можно взять у других студентов и отдать
                свои, которые уже прочитаны.
              </p>
              <div className="mt-10 flex flex-wrap items-center gap-3">
                <Link
                  href="/catalog"
                  className="inline-flex items-center gap-3 rounded-full bg-indigo-600 py-2 pl-6 pr-2 text-base font-semibold text-white transition hover:bg-indigo-500"
                >
                  Открыть каталог
                  <span className="flex size-9 items-center justify-center rounded-full bg-white text-indigo-700">
                    <FiArrowRight />
                  </span>
                </Link>
                <UserOnly>
                  <LinkButton
                    href="/add"
                    variant="outline"
                    size="lg"
                    className="!bg-transparent !text-white !ring-white/40 hover:!bg-white/10"
                  >
                    Добавить книгу
                  </LinkButton>
                </UserOnly>
              </div>
            </div>

            <dl className="grid grid-cols-3 gap-4 rounded-3xl bg-white/10 p-6 text-center ring-1 ring-white/20 backdrop-blur lg:ml-auto lg:max-w-sm">
              <div><dd className="font-serif text-4xl">{books.length}</dd><dt className="mt-1 text-xs text-stone-200">Изданий</dt></div>
              <div><dd className="font-serif text-4xl">{cats.length}</dd><dt className="mt-1 text-xs text-stone-200">Категорий</dt></div>
              <div><dd className="font-serif text-4xl">5</dd><dt className="mt-1 text-xs text-stone-200">Городов</dt></div>
            </dl>
          </div>
        </div>
      </section>

      {/* Категории */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <h2 className="text-4xl text-stone-900 sm:text-5xl">Категории</h2>
        <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {cats.map((c, i) => (
            <Link
              key={c.key}
              href={`/catalog?category=${c.key}`}
              className={`group relative flex aspect-[4/5] flex-col justify-end overflow-hidden rounded-3xl bg-gradient-to-br p-5 text-white transition hover:-translate-y-1 hover:shadow-xl ${tones[i % tones.length]}`}
            >
              <CategoryIcon category={c.key} icon={c.icon} className="absolute right-4 top-4 text-5xl text-white/25 transition group-hover:text-white/40" />
              <p className="text-sm text-white/70">{String(i + 1).padStart(2, "0")}</p>
              <p className="mt-1 text-lg font-semibold">{c.label}</p>
              <p className="text-sm text-white/70">{books.filter((b) => b.category === c.key).length} шт.</p>
            </Link>
          ))}
        </div>
      </section>

      {/* Доступно сейчас */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between">
          <h2 className="text-4xl text-stone-900 sm:text-5xl">Доступно сейчас</h2>
          <LinkButton href="/catalog" variant="ghost">Весь каталог <FiArrowRight /></LinkButton>
        </div>
        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {popular.map((b) => (
            <BookCard key={b.id} book={b} />
          ))}
        </div>
      </section>

      {/* Как это работает */}
      <section className="mx-auto mt-24 grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[1fr_1.6fr] lg:px-8">
        <h2 className="text-4xl leading-tight text-stone-900 sm:text-5xl">Как это работает</h2>
        <ol className="border-t border-stone-300">
          {steps.map((s) => (
            <li key={s.n} className="flex items-start gap-6 border-b border-stone-300 py-6">
              <span className="pt-1 text-sm text-stone-400">{s.n.padStart(2, "0")}</span>
              <div>
                <h3 className="font-semibold text-stone-900">{s.title}</h3>
                <p className="mt-1 text-sm text-stone-500">{s.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Призыв */}
      <section className="mx-auto mt-24 max-w-7xl px-3 sm:px-6 lg:px-8">
        <div className="rounded-[2rem] bg-gradient-to-br from-stone-900 via-stone-800 to-indigo-950 px-6 py-16 text-white sm:px-14">
          <h2 className="max-w-xl text-4xl leading-tight sm:text-5xl">Есть ненужные книги или конспекты?</h2>
          <p className="mt-4 max-w-md text-stone-300">
            Отдайте их тому, кому они нужны прямо сейчас.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <LinkButton href="/register" size="lg">Присоединиться</LinkButton>
            <UserOnly>
              <LinkButton
                href="/add"
                variant="outline"
                size="lg"
                className="!bg-transparent !text-white !ring-white/40 hover:!bg-white/10"
              >
                Добавить книгу
              </LinkButton>
            </UserOnly>
          </div>
        </div>
      </section>
    </>
  );
}
