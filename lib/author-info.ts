import { readJson, withLock, writeJson } from "./db";

/**
 * Краткая справка об авторе из Википедии и Викиданных (бесплатно, без ключа).
 * Результат кэшируется в data/authors.json, чтобы не ходить в сеть при каждом открытии страницы.
 * Если у записи есть поле `manual`, оно главнее автоматических данных (ручная правка файла/админом).
 */

export type AuthorInfo = {
  name: string;
  description?: string; // «Русский поэт, прозаик…»
  extract?: string; // текст статьи (краткий)
  born?: string;
  died?: string;
  birthPlace?: string;
  photo?: string;
  url?: string; // страница в Википедии
  source: "wikipedia" | "manual";
};

type Entry = {
  key: string;
  status: "ok" | "none" | "error";
  fetchedAt: string;
  info?: AuthorInfo;
  manual?: Partial<AuthorInfo>;
};

const FILE = "authors.json";
const TTL_MS = { ok: 30 * 86_400_000, none: 7 * 86_400_000, error: 10 * 60_000 };
const UA = "Page2Page/1.0 (student book exchange; contact: admin@page2page.local)";

export const authorKey = (name: string) =>
  name.trim().toLowerCase().replace(/ё/g, "е").replace(/\s+/g, " ");

/** Несколько авторов в одном поле («А, Б, В») — справку не показываем. */
export const isSingleAuthor = (name: string) => !/[,;&]| и | and /i.test(name) && name.trim().length > 1;

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    cache: "no-store",
    headers: { "User-Agent": UA, Accept: "application/json" },
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
}

const MONTHS = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];

/** "+1814-10-03T00:00:00Z", precision 11 → "3 октября 1814" */
function formatWikidataTime(v?: { time: string; precision: number }): string | undefined {
  if (!v) return undefined;
  const m = /^([+-])(\d{1,})-(\d\d)-(\d\d)/.exec(v.time);
  if (!m) return undefined;
  const year = Number(m[2]);
  const era = m[1] === "-" ? " до н. э." : "";
  if (v.precision >= 11) return `${Number(m[4])} ${MONTHS[Number(m[3]) - 1]} ${year}${era}`;
  if (v.precision === 10) return `${MONTHS[Number(m[3]) - 1]} ${year}${era}`;
  return `${year}${era}`;
}

type WdClaim = { mainsnak?: { datavalue?: { value?: any } } };
type WdEntity = {
  id: string;
  claims?: Record<string, WdClaim[]>;
  sitelinks?: Record<string, { title: string }>;
  labels?: Record<string, { value: string }>;
};

const WD = "https://www.wikidata.org/w/api.php";

async function fetchFromWikipedia(name: string): Promise<AuthorInfo | null> {
  const wanted = authorKey(name);

  // 1. ищем человека в Викиданных: сначала по-русски, затем по-английски
  let candidates: { id: string; match?: { text?: string } }[] = [];
  for (const lang of ["ru", "en"]) {
    const s = await getJson<{ search?: typeof candidates }>(
      `${WD}?action=wbsearchentities&format=json&type=item&limit=7&language=${lang}&uselang=${lang}&search=${encodeURIComponent(name)}`,
    );
    // имя должно совпасть с названием/псевдонимом целиком, иначе рискуем показать чужую статью
    candidates = (s.search ?? []).filter((c) => authorKey(c.match?.text ?? "") === wanted);
    if (candidates.length) break;
  }
  if (!candidates.length) return null;

  const ids = candidates.map((c) => c.id).join("|");
  const ents = await getJson<{ entities?: Record<string, WdEntity> }>(
    `${WD}?action=wbgetentities&format=json&ids=${ids}&props=claims|sitelinks&sitefilter=ruwiki|enwiki`,
  );

  // 2. первый кандидат — человек (P31 = Q5) со статьёй в Википедии
  let entity: WdEntity | undefined;
  for (const c of candidates) {
    const e = ents.entities?.[c.id];
    const isHuman = e?.claims?.P31?.some((x) => x.mainsnak?.datavalue?.value?.id === "Q5");
    if (e && isHuman && (e.sitelinks?.ruwiki || e.sitelinks?.enwiki)) {
      entity = e;
      break;
    }
  }
  if (!entity) return null;

  const lang = entity.sitelinks?.ruwiki ? "ru" : "en";
  const title = (entity.sitelinks?.ruwiki ?? entity.sitelinks?.enwiki)!.title;

  // 3. краткая статья
  const sum = await getJson<{
    description?: string;
    extract?: string;
    thumbnail?: { source?: string };
    content_urls?: { desktop?: { page?: string } };
    type?: string;
  }>(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, "_"))}`);
  if (sum.type === "disambiguation") return null;

  // 4. даты и место рождения
  const claim = (p: string) => entity!.claims?.[p]?.[0]?.mainsnak?.datavalue?.value;
  const born = formatWikidataTime(claim("P569"));
  const died = formatWikidataTime(claim("P570"));

  let birthPlace: string | undefined;
  const placeId = claim("P19")?.id as string | undefined;
  if (placeId) {
    try {
      const p = await getJson<{ entities?: Record<string, WdEntity> }>(
        `${WD}?action=wbgetentities&format=json&ids=${placeId}&props=labels&languages=ru|en`,
      );
      const l = p.entities?.[placeId]?.labels;
      birthPlace = l?.ru?.value ?? l?.en?.value;
    } catch {
      /* место рождения — необязательная деталь */
    }
  }

  return {
    name: title.replace(/ \(.*\)$/, ""),
    description: sum.description,
    extract: sum.extract,
    born,
    died,
    birthPlace,
    photo: sum.thumbnail?.source,
    url: sum.content_urls?.desktop?.page ?? `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(title)}`,
    source: "wikipedia",
  };
}

export async function getAuthorInfo(name: string): Promise<AuthorInfo | null> {
  if (!isSingleAuthor(name)) return null;
  const key = authorKey(name);

  const all = await readJson<Entry[]>(FILE, []);
  const hit = all.find((e) => e.key === key);

  if (hit?.manual && (hit.manual.extract || hit.manual.description)) {
    return { name, source: "manual", ...(hit.info ?? {}), ...hit.manual } as AuthorInfo;
  }
  if (hit && Date.now() - new Date(hit.fetchedAt).getTime() < TTL_MS[hit.status]) {
    return hit.status === "ok" ? (hit.info ?? null) : null;
  }

  let status: Entry["status"] = "none";
  let info: AuthorInfo | null = null;
  try {
    info = await fetchFromWikipedia(name);
    status = info ? "ok" : "none";
  } catch {
    status = "error";
  }

  await withLock("authors", async () => {
    const fresh = await readJson<Entry[]>(FILE, []);
    const prev = fresh.find((e) => e.key === key);
    const entry: Entry = {
      key,
      status,
      fetchedAt: new Date().toISOString(),
      info: info ?? undefined,
      manual: prev?.manual,
    };
    await writeJson(FILE, [...fresh.filter((e) => e.key !== key), entry]);
  });

  return info;
}
