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
  source: "wikipedia" | "wikidata" | "openlibrary" | "manual";
};

type Entry = {
  key: string;
  /** версия алгоритма поиска: старые «не найдено» перепроверяются новым, более умным поиском */
  v?: number;
  status: "ok" | "none" | "error";
  fetchedAt: string;
  info?: AuthorInfo;
  manual?: Partial<AuthorInfo>;
};

const FILE = "authors.json";
const ALGO_VERSION = 3;
const TTL_MS = { ok: 30 * 86_400_000, none: 7 * 86_400_000, error: 10 * 60_000 };
const UA = "Page2Page/1.0 (student book exchange; contact: admin@page2page.local)";

export const authorKey = (name: string) =>
  name.trim().toLowerCase().replace(/ё/g, "е").replace(/\s+/g, " ");

/** Несколько авторов в одном поле («А, Б, В») → отдельные имена. «Оруэлл, Джордж» остаётся одним автором. */
export function splitAuthors(name: string): string[] {
  const parts = name
    .split(/\s*(?:[,;&]|\s+и\s+|\s+and\s+)\s*/i)
    .map((x) => x.trim())
    .filter((x) => x.length > 1);
  if (parts.length === 2 && parts.every((x) => !/\s/.test(x))) return [name.trim()]; // «Фамилия, Имя»
  return parts.length ? parts : [name.trim()];
}

export const isSingleAuthor = (name: string) => splitAuthors(name).length === 1 && name.trim().length > 1;

const norm = (s: string) => s.toLowerCase().replace(/ё/g, "е").replace(/[()]/g, " ").replace(/\s+/g, " ").trim();
const isInitial = (t: string) => /^\p{L}\.?$/u.test(t);

export type ParsedName = {
  surname: string;
  /** полные имена/отчества, без инициалов */
  given: string[];
  /** первая буква имени (из полного имени или инициала) */
  firstLetter: string;
  hasInitials: boolean;
};

/** «Д.В. Сивухин», «Лобкова Н.И.», «Джером Дэвид Сэлинджер», «Оруэлл, Джордж» → фамилия + имена. */
export function parseAuthorName(raw: string): ParsedName {
  let t = raw.replace(/([\p{L}])\.(?=\p{L})/gu, "$1. ").replace(/,/g, " ");
  const tokens = t.split(/\s+/).filter(Boolean);
  const comma = raw.includes(",");
  const initials = tokens.filter(isInitial);
  const words = tokens.filter((x) => !isInitial(x));
  let surname: string;
  let given: string[];
  if (initials.length && words.length) {
    // «Лобкова Н.И.» / «Д.В. Сивухин»: фамилия — единственное полное слово (или последнее)
    surname = words[words.length - 1];
    given = words.slice(0, -1);
  } else if (comma && words.length >= 2) {
    surname = words[0];
    given = words.slice(1);
  } else {
    surname = words[words.length - 1] ?? tokens[tokens.length - 1] ?? raw;
    given = words.slice(0, -1);
  }
  const firstLetter = norm(given[0] ?? initials[0] ?? "").charAt(0);
  return { surname: norm(surname), given: given.map(norm), firstLetter, hasInitials: initials.length > 0 };
}

/** Подходит ли заголовок статьи Википедии под имя автора (фамилия + начало имени; отчество/инициалы допускаются). */
export function titleMatches(title: string, p: ParsedName): boolean {
  const t = norm(title.replace(/\s*\(.*\)\s*$/, "")).replace(/,/g, " ");
  const tt = t.split(" ").filter(Boolean);
  if (!p.surname || !tt.includes(p.surname)) return false;
  const rest = tt.filter((x) => x !== p.surname);
  if (!p.firstLetter) return true;
  if (!rest.length) return false;
  // имя автора из каталога может быть написано как «Федор», «Джером», «Ф.» — сверяем начало
  const g = p.given[0];
  return rest.some((x) => (g && g.length >= 3 ? x.slice(0, 3) === g.slice(0, 3) : x.startsWith(p.firstLetter)));
}

/** Варианты запроса: как есть; «имя фамилия» без отчества; «фамилия + инициалы». */
export function searchVariants(raw: string): string[] {
  const p = parseAuthorName(raw);
  const out = [raw.replace(/,/g, " ").replace(/\s+/g, " ").trim()];
  if (p.given[0]) out.push(`${p.given[0]} ${p.surname}`);
  if (p.hasInitials || !p.given[0]) out.push(`${p.surname} ${p.firstLetter ? p.firstLetter.toUpperCase() + "." : ""}`.trim());
  return Array.from(new Set(out.map((x) => x.trim()).filter(Boolean)));
}

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
  descriptions?: Record<string, { value: string }>;
};

const WD = "https://www.wikidata.org/w/api.php";

type Candidate = { id: string };

/** Поиск по Википедии (ru, en, kk) с проверкой, что статья именно об этом авторе. Возвращает id Викиданных. */
async function candidatesFromWikiSearch(name: string): Promise<Candidate[]> {
  const parsed = parseAuthorName(name);
  const found: Candidate[] = [];
  let sawError = false;

  for (const lang of ["ru", "en", "kk"]) {
    for (const q of searchVariants(name)) {
      try {
        const sr = await getJson<{ query?: { search?: { title: string }[] } }>(
          `https://${lang}.wikipedia.org/w/api.php?action=query&list=search&format=json&srnamespace=0&srlimit=6&srsearch=${encodeURIComponent(q)}`,
        );
        for (const hit of sr.query?.search ?? []) {
          if (!titleMatches(hit.title, parsed)) continue;
          const pp = await getJson<{ query?: { pages?: Record<string, { pageprops?: { wikibase_item?: string } }> } }>(
            `https://${lang}.wikipedia.org/w/api.php?action=query&format=json&redirects=1&prop=pageprops&ppprop=wikibase_item&titles=${encodeURIComponent(hit.title)}`,
          );
          const id = Object.values(pp.query?.pages ?? {})[0]?.pageprops?.wikibase_item;
          if (id && !found.some((c) => c.id === id)) found.push({ id });
        }
      } catch {
        sawError = true;
      }
      if (found.length) return found;
    }
  }
  if (!found.length && sawError) throw new Error("wiki search failed");
  return found;
}

async function fetchFromWikipedia(name: string): Promise<AuthorInfo | null> {
  const wanted = authorKey(name);

  // 1. точное совпадение в Викиданных: сначала по-русски, затем по-английски
  let candidates: Candidate[] = [];
  for (const lang of ["ru", "en"]) {
    const s = await getJson<{ search?: { id: string; match?: { text?: string } }[] }>(
      `${WD}?action=wbsearchentities&format=json&type=item&limit=7&language=${lang}&uselang=${lang}&search=${encodeURIComponent(name)}`,
    );
    candidates = (s.search ?? []).filter((c) => authorKey(c.match?.text ?? "") === wanted);
    if (candidates.length) break;
  }
  // 2. не нашли — ищем по Википедии с учётом инициалов, отчеств, «Фамилия, Имя», ё/е и т. д.
  if (!candidates.length) candidates = await candidatesFromWikiSearch(name);
  // 3. статьи нет — ищем человека в одних только Викиданных (описание, даты, фото)
  if (!candidates.length) candidates = await candidatesFromWikidataFuzzy(name);
  if (!candidates.length) return null;

  const ids = candidates.map((c) => c.id).join("|");
  const ents = await getJson<{ entities?: Record<string, WdEntity> }>(
    `${WD}?action=wbgetentities&format=json&ids=${ids}&props=claims|sitelinks|labels|descriptions&languages=ru|en|kk&sitefilter=ruwiki|enwiki`,
  );

  const isHuman = (e?: WdEntity) => !!e?.claims?.P31?.some((x) => x.mainsnak?.datavalue?.value?.id === "Q5");
  // первый кандидат — человек (P31 = Q5) со статьёй в Википедии; иначе человек из Викиданных без статьи
  let entity: WdEntity | undefined;
  for (const c of candidates) {
    const e = ents.entities?.[c.id];
    if (e && isHuman(e) && (e.sitelinks?.ruwiki || e.sitelinks?.enwiki)) {
      entity = e;
      break;
    }
  }
  const wikiless = !entity;
  if (!entity) entity = candidates.map((c) => ents.entities?.[c.id]).find((e) => isHuman(e));
  if (!entity) return null;

  // даты, место рождения, фото
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

  if (wikiless) {
    // Статьи в Википедии нет — берём то, что есть в Викиданных
    const d = entity.descriptions;
    const description = d?.ru?.value ?? d?.kk?.value ?? d?.en?.value;
    const label = entity.labels?.ru?.value ?? entity.labels?.kk?.value ?? entity.labels?.en?.value ?? name;
    const file = claim("P18");
    const photo =
      typeof file === "string"
        ? `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=400`
        : undefined;
    if (!description && !born && !died && !birthPlace) return null;
    return {
      name: label,
      description,
      born,
      died,
      birthPlace,
      photo,
      url: `https://www.wikidata.org/wiki/${entity.id}`,
      source: "wikidata",
    };
  }

  const lang = entity.sitelinks?.ruwiki ? "ru" : "en";
  const title = (entity.sitelinks?.ruwiki ?? entity.sitelinks?.enwiki)!.title;

  // краткая статья
  const sum = await getJson<{
    description?: string;
    extract?: string;
    thumbnail?: { source?: string };
    content_urls?: { desktop?: { page?: string } };
    type?: string;
  }>(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, "_"))}`);
  if (sum.type === "disambiguation") return null;

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

/** Нестрогий поиск человека в Викиданных: имя из каталога сверяется по фамилии и началу имени. */
async function candidatesFromWikidataFuzzy(name: string): Promise<Candidate[]> {
  const parsed = parseAuthorName(name);
  const found: Candidate[] = [];
  let sawError = false;
  for (const lang of ["ru", "en", "kk"]) {
    for (const q of searchVariants(name)) {
      try {
        const s = await getJson<{ search?: { id: string; label?: string; match?: { text?: string } }[] }>(
          `${WD}?action=wbsearchentities&format=json&type=item&limit=7&language=${lang}&uselang=${lang}&search=${encodeURIComponent(q)}`,
        );
        for (const c of s.search ?? []) {
          const text = c.match?.text ?? c.label ?? "";
          if (titleMatches(text, parsed) && !found.some((f) => f.id === c.id)) found.push({ id: c.id });
        }
      } catch {
        sawError = true;
      }
      if (found.length) return found;
    }
  }
  if (!found.length && sawError) throw new Error("wikidata search failed");
  return found;
}

/** Open Library: биография, годы жизни и фото автора (особенно для зарубежных авторов). */
async function fetchFromOpenLibrary(name: string): Promise<AuthorInfo | null> {
  const parsed = parseAuthorName(name);
  let sawError = false;
  for (const q of searchVariants(name)) {
    try {
      const r = await getJson<{
        docs?: { key: string; name: string; birth_date?: string; death_date?: string; top_work?: string }[];
      }>(`https://openlibrary.org/search/authors.json?limit=5&q=${encodeURIComponent(q)}`);
      const doc = r.docs?.find((d) => titleMatches(d.name, parsed));
      if (!doc) continue;

      const a = await getJson<{
        bio?: string | { value?: string };
        birth_date?: string;
        death_date?: string;
        photos?: number[];
      }>(`https://openlibrary.org/authors/${doc.key}.json`);

      let bio = typeof a.bio === "string" ? a.bio : (a.bio?.value ?? "");
      bio = bio
        .split(/\n-{3,}/)[0] // после «----------» идут служебные ссылки
        .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1") // markdown-ссылки → текст
        .replace(/\s+/g, " ")
        .trim();
      if (bio.length > 900) bio = bio.slice(0, 900).replace(/[^.!?]*$/, "").trim() || bio.slice(0, 900);

      const born = a.birth_date ?? doc.birth_date;
      const died = a.death_date ?? doc.death_date;
      if (!bio && !born && !died) continue;
      const photoId = a.photos?.find((x) => x > 0);
      return {
        name: doc.name,
        description: doc.top_work ? `Автор книги «${doc.top_work}»` : undefined,
        extract: bio || undefined,
        born,
        died,
        photo: photoId ? `https://covers.openlibrary.org/a/id/${photoId}-M.jpg` : undefined,
        url: `https://openlibrary.org/authors/${doc.key}`,
        source: "openlibrary",
      };
    } catch {
      sawError = true;
    }
  }
  if (sawError) throw new Error("openlibrary failed");
  return null;
}

/** Источники по очереди: Википедия → Викиданные → Open Library. */
async function fetchAuthorInfo(name: string): Promise<AuthorInfo | null> {
  let failed = false;
  try {
    const w = await fetchFromWikipedia(name);
    if (w && w.source === "wikipedia") return w;
    if (w) {
      // из Викиданных (без статьи): пробуем дополнить биографией из Open Library
      try {
        const o = await fetchFromOpenLibrary(name);
        if (o?.extract) return { ...w, extract: o.extract, source: "openlibrary", url: o.url, photo: w.photo ?? o.photo };
      } catch {
        /* оставляем данные Викиданных */
      }
      return w;
    }
  } catch {
    failed = true;
  }
  try {
    const o = await fetchFromOpenLibrary(name);
    if (o) return o;
  } catch {
    failed = true;
  }
  if (failed) throw new Error("sources unavailable");
  return null;
}

export async function getAuthorInfo(name: string): Promise<AuthorInfo | null> {
  if (name.trim().length < 2) return null;
  const key = authorKey(name);

  const all = await readJson<Entry[]>(FILE, []);
  const hit = all.find((e) => e.key === key);

  if (hit?.manual && (hit.manual.extract || hit.manual.description)) {
    return { name, source: "manual", ...(hit.info ?? {}), ...hit.manual } as AuthorInfo;
  }
  const fresh = hit && Date.now() - new Date(hit.fetchedAt).getTime() < TTL_MS[hit.status];
  // «не найдено», записанное старым алгоритмом, перепроверяем новым
  const stale = hit && hit.status !== "ok" && (hit.v ?? 1) < ALGO_VERSION;
  if (hit && fresh && !stale) return hit.status === "ok" ? (hit.info ?? null) : null;

  let status: Entry["status"] = "none";
  let info: AuthorInfo | null = null;
  try {
    info = await fetchAuthorInfo(name);
    status = info ? "ok" : "none";
  } catch {
    status = "error";
  }

  await withLock("authors", async () => {
    const cur = await readJson<Entry[]>(FILE, []);
    const prev = cur.find((e) => e.key === key);
    const entry: Entry = {
      key,
      v: ALGO_VERSION,
      status,
      fetchedAt: new Date().toISOString(),
      info: info ?? undefined,
      manual: prev?.manual,
    };
    await writeJson(FILE, [...cur.filter((e) => e.key !== key), entry]);
  });

  return info;
}
