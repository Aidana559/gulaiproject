import { getAuthorInfo } from "@/lib/author-info";

/** «Об авторе»: краткая справка из Википедии/Викиданных. Если данных нет — блок не показывается. */
export default async function AuthorInfoCard({ author }: { author: string }) {
  const info = await getAuthorInfo(author);
  if (!info || !(info.extract || info.description)) return null;

  const years = [info.born, info.died].filter(Boolean).join(" — ");

  return (
    <aside aria-label="Об авторе" className="min-w-0 rounded-2xl bg-white p-5 ring-1 ring-stone-200">
      <h2 className="text-lg font-bold text-stone-900">Об авторе</h2>

      <div className="mt-3 flex items-start gap-3">
        {info.photo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={info.photo}
            alt={info.name}
            loading="lazy"
            referrerPolicy="no-referrer"
            className="h-20 w-16 shrink-0 rounded-lg object-cover ring-1 ring-black/5"
          />
        )}
        <div className="min-w-0">
          <p className="font-semibold text-stone-900">{info.name}</p>
          {info.description && (
            <p className="mt-0.5 text-sm text-stone-500 first-letter:uppercase">{info.description}</p>
          )}
        </div>
      </div>

      {info.extract && (
        <p className="mt-4 line-clamp-6 text-sm leading-relaxed text-stone-700">{info.extract}</p>
      )}

      {(years || info.birthPlace) && (
        <dl className="mt-4 grid grid-cols-[6.5rem_1fr] gap-x-3 gap-y-2 text-sm">
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

      {info.source === "wikipedia" && info.url && (
        <p className="mt-4 border-t border-stone-100 pt-3 text-xs text-stone-400">
          Текст —{" "}
          <a href={info.url} target="_blank" rel="noopener noreferrer" className="underline hover:text-indigo-600">
            Википедия
          </a>
          , CC BY-SA. Данные — Викиданные. Фото — Wikimedia Commons.
        </p>
      )}
    </aside>
  );
}
