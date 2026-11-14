import { getAuthorInfo, type AuthorInfo } from "@/lib/author-info";
import { genresOf } from "@/lib/genres";

type BookLite = { title: string; genre?: string; genres?: string[]; year?: number };

function Heading({ name, total }: { name: string; total: number }) {
  return (
    <>
      <h1 className="text-3xl font-extrabold text-stone-900">{name}</h1>
      <p className="mt-1 text-stone-500">Книг этого автора в каталоге: {total}</p>
    </>
  );
}

/** Заголовок страницы автора, пока справка ещё грузится. */
export function AuthorHeadingOnly({ name, total }: { name: string; total: number }) {
  return (
    <div className="mt-4">
      <Heading name={name} total={total} />
    </div>
  );
}

/** Если ни в одном открытом источнике автора нет — справка строится из данных самого каталога. */
function catalogSummary(books: BookLite[]): { description: string; extract: string } | null {
  if (!books.length) return null;
  const titles = books.slice(0, 5).map((b) => `«${b.title}»`);
  const more = books.length > 5 ? ` и ещё ${books.length - 5}` : "";
  const genres = Array.from(new Set(books.flatMap((b) => genresOf(b)))).slice(0, 6);
  const years = books.map((b) => b.year).filter((y): y is number => !!y && y > 0);
  return {
    description: `Автор книг из каталога Kitapta`,
    extract:
      `В каталоге представлены книги: ${titles.join(", ")}${more}.` +
      (genres.length ? ` Жанры и темы: ${genres.join(", ").toLowerCase()}.` : "") +
      (years.length ? ` Годы издания — ${Math.min(...years)}${Math.max(...years) !== Math.min(...years) ? `–${Math.max(...years)}` : ""}.` : ""),
  };
}

function Credit({ info }: { info: AuthorInfo }) {
  const link = (href: string | undefined, text: string) =>
    href ? (
      <a href={href} target="_blank" rel="noopener noreferrer" className="underline hover:text-indigo-600">
        {text}
      </a>
    ) : (
      text
    );
  return (
    <p className="mt-4 text-xs text-stone-400">
      {info.source === "wikipedia" && (
        <>Текст — {link(info.url, "Википедия")}, CC BY-SA. Данные — Викиданные. Фото — Wikimedia Commons.</>
      )}
      {info.source === "wikidata" && <>Данные — {link(info.url, "Викиданные")}. Фото — Wikimedia Commons.</>}
      {info.source === "openlibrary" && <>Данные — {link(info.url, "Open Library")}.</>}
    </p>
  );
}

/**
 * Шапка страницы автора: имя, а под ним справка — Википедия → Викиданные → Open Library,
 * а если автора нет ни в одном источнике, то сводка по его книгам из каталога.
 */
export default async function AuthorProfile({
  author,
  total,
  books = [],
  member = false,
}: {
  author: string;
  total?: number;
  books?: BookLite[];
  /** true — один из нескольких соавторов: имя выводится как h2, без счётчика книг */
  member?: boolean;
}) {
  const info = await getAuthorInfo(author);
  const hasInfo = !!info && !!(info.extract || info.description || info.born || info.birthPlace);

  const title = member ? (
    <h2 className="text-2xl font-bold text-stone-900">{author}</h2>
  ) : (
    <Heading name={author} total={total ?? 0} />
  );
  const wrap = member ? "rounded-2xl bg-white p-5 ring-1 ring-stone-200" : "mt-4";

  if (!info || !hasInfo) {
    const c = catalogSummary(books);
    return (
      <section aria-label={`Автор: ${author}`} className={wrap}>
        {title}
        {c && (
          <>
            <p className="mt-3 text-lg text-stone-600">{c.description}</p>
            <p className="mt-3 max-w-3xl leading-relaxed text-stone-700">{c.extract}</p>
          </>
        )}
      </section>
    );
  }

  const years = [info.born, info.died].filter(Boolean).join(" — ");

  return (
    <section aria-label={`Справка об авторе: ${author}`} className={wrap}>
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
        {info.photo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={info.photo}
            alt={info.name}
            referrerPolicy="no-referrer"
            className="h-56 w-44 shrink-0 rounded-2xl object-cover shadow-sm ring-1 ring-black/5"
          />
        )}

        <div className="min-w-0 max-w-3xl">
          {title}
          {info.description && (
            <p className="mt-3 text-lg text-stone-600 first-letter:uppercase">{info.description}</p>
          )}

          {(years || info.birthPlace) && (
            <dl className="mt-4 grid grid-cols-[8rem_1fr] gap-x-3 gap-y-2 text-sm">
              {years && (
                <>
                  <dt className="text-stone-400">Годы жизни</dt>
                  <dd className="font-medium text-stone-800">{years}</dd>
                </>
              )}
              {info.birthPlace && (
                <>
                  <dt className="text-stone-400">Место рождения</dt>
                  <dd className="font-medium text-stone-800">{info.birthPlace}</dd>
                </>
              )}
            </dl>
          )}

          {info.extract && <p className="mt-4 leading-relaxed text-stone-700">{info.extract}</p>}
          <Credit info={info} />
        </div>
      </div>
    </section>
  );
}
