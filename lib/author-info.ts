import { readJson, withLock, writeJson } from "./db";



export type AuthorInfo = {
  name: string;
  description?: string;
  extract?: string;
  born?: string;
  died?: string;
  birthPlace?: string;
  photo?: string;
  /** Primary source page (prefer Wikipedia when available). */
  url?: string;
  wikipediaUrl?: string;
  wikidataUrl?: string;
  openLibraryUrl?: string;
  source: "wikipedia" | "wikidata" | "openlibrary" | "manual";
};

type Entry = {
  key: string;
  
  v?: number;
  status: "ok" | "none" | "error";
  fetchedAt: string;
  info?: AuthorInfo;
  manual?: Partial<AuthorInfo>;
  aliases?: string[];
};

const FILE = "authors.json";
const ALGO_VERSION = 6;
const TTL_MS = { ok: 30 * 86_400_000, none: 7 * 86_400_000, error: 10 * 60_000 };
const UA = "Kitapta/1.0 (student book exchange; contact: admin@kitapta.local)";

export const authorKey = (name: string) =>
  name.trim().toLowerCase().replace(/ё/g, "е").replace(/\s+/g, " ");


export function splitAuthors(name: string): string[] {
  const parts = name
    .split(/\s*(?:[,;&]|\s+и\s+|\s+and\s+)\s*/i)
    .map((x) => x.trim())
    .filter((x) => x.length > 1);
  if (parts.length === 2 && parts.every((x) => !/\s/.test(x))) return [name.trim()];
  return parts.length ? parts : [name.trim()];
}

export const isSingleAuthor = (name: string) => splitAuthors(name).length === 1 && name.trim().length > 1;

const translit: Record<string, string> = { shch:"щ", sch:"щ", zh:"ж", kh:"х", ts:"ц", ch:"ч", sh:"ш", ya:"я", yu:"ю", yo:"ё", ye:"е", a:"а", b:"б", v:"в", g:"г", d:"д", e:"е", z:"з", i:"и", y:"й", k:"к", l:"л", m:"м", n:"н", o:"о", p:"п", r:"р", s:"с", t:"т", u:"у", f:"ф", h:"х", c:"к", "'":"ь" };
const cyr = (s: string) => s.toLowerCase().replace(/[’ʼ]/g, "'").replace(/shch|sch|zh|kh|ts|ch|sh|ya|yu|yo|ye|[a-z']/g, x => translit[x] ?? x);
const norm = (s: string) => s.toLowerCase().replace(/ё/g, "е").replace(/[()]/g, " ").replace(/\s+/g, " ").trim();
const isInitial = (t: string) => /^\p{L}\.?$/u.test(t);

export type ParsedName = {
  surname: string;
  
  given: string[];
  
  firstLetter: string;
  hasInitials: boolean;
};


export function parseAuthorName(raw: string): ParsedName {
  let t = raw.replace(/([\p{L}])\.(?=\p{L})/gu, "$1. ").replace(/,/g, " ");
  const tokens = t.split(/\s+/).filter(Boolean);
  const comma = raw.includes(",");
  const initials = tokens.filter(isInitial);
  const words = tokens.filter((x) => !isInitial(x));
  let surname: string;
  let given: string[];
  if (initials.length && words.length) {
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


export function titleMatches(title: string, p: ParsedName): boolean {
  const t = norm(title.replace(/\s*\(.*\)\s*$/, "")).replace(/,/g, " ");
  const tt = t.split(" ").filter(Boolean);
  if (!p.surname || !tt.some(x => x === p.surname || cyr(x) === cyr(p.surname))) return false;
  const rest = tt.filter((x) => cyr(x) !== cyr(p.surname));
  if (!p.firstLetter) return true;
  if (!rest.length) return false;
  const g = p.given[0];
  return rest.some((x) => (g && g.length >= 3 ? cyr(x).slice(0, 3) === cyr(g).slice(0, 3) : cyr(x).startsWith(cyr(p.firstLetter))));
}


export function searchVariants(raw: string): string[] {
  const p = parseAuthorName(raw);
  const out = [raw.replace(/,/g, " ").replace(/\s+/g, " ").trim()];
  if (p.given[0]) out.push(`${p.given[0]} ${p.surname}`);
  if (p.hasInitials || !p.given[0]) out.push(`${p.surname} ${p.firstLetter ? p.firstLetter.toUpperCase() + "." : ""}`.trim());
  if (/^[a-z\s.,’'ʼ-]+$/i.test(raw)) out.push(cyr(raw));
  return Array.from(new Set(out.map((x) => x.trim()).filter(Boolean)));
}

async function getJson<T>(url: string, retries = 1): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        cache: "no-store",
        headers: { "User-Agent": UA, Accept: "application/json" },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()) as T;
    } catch (e) {
      lastErr = e;
      if (attempt < retries) await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

const MONTHS = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];


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


async function candidatesFromWikiSearch(name: string): Promise<Candidate[]> {
  const parsed = parseAuthorName(name);
  const found: Candidate[] = [];
  let sawError = false;

  // Prefer literary context in search (helps disambiguate e.g. Kevin Anderson writer vs tennis player)
  const literaryHints = ["писатель", "writer", "author", "романист"];
  const baseVariants = searchVariants(name);
  const variants = [
    ...baseVariants,
    ...baseVariants.flatMap((v) => literaryHints.map((h) => `${v} ${h}`)),
  ];

  for (const lang of ["ru", "en", "kk"]) {
    for (const q of variants) {
      try {
        const sr = await getJson<{ query?: { search?: { title: string }[] } }>(
          `https://${lang}.wikipedia.org/w/api.php?action=query&list=search&format=json&srnamespace=0&srlimit=8&srsearch=${encodeURIComponent(q)}`,
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
      // Collect several candidates; ranking happens later in fetchFromWikipedia
      if (found.length >= 5) return found;
    }
  }
  if (!found.length && sawError) throw new Error("wiki search failed");
  return found;
}

async function fetchFromWikipedia(name: string): Promise<AuthorInfo | null> {
  const wanted = authorKey(name);
  let candidates: Candidate[] = [];
  for (const lang of ["ru", "en"]) {
    const s = await getJson<{ search?: { id: string; match?: { text?: string } }[] }>(
      `${WD}?action=wbsearchentities&format=json&type=item&limit=7&language=${lang}&uselang=${lang}&search=${encodeURIComponent(name)}`,
    );
    candidates = (s.search ?? []).filter((c) => authorKey(c.match?.text ?? "") === wanted);
    if (candidates.length) break;
  }
  if (!candidates.length) candidates = await candidatesFromWikiSearch(name);
  if (!candidates.length) candidates = await candidatesFromWikidataFuzzy(name);
  if (!candidates.length) return null;

  const ids = candidates.map((c) => c.id).join("|");
  const ents = await getJson<{ entities?: Record<string, WdEntity> }>(
    `${WD}?action=wbgetentities&format=json&ids=${ids}&props=claims|sitelinks|labels|descriptions&languages=ru|en|kk&sitefilter=ruwiki|enwiki`,
  );

  const isHuman = (e?: WdEntity) => !!e?.claims?.P31?.some((x) => x.mainsnak?.datavalue?.value?.id === "Q5");

  // Prefer writers / literary people over athletes, politicians, etc.
  // Occupations: writer, novelist, poet, playwright, journalist, author, science fiction writer…
  const WRITER_OCCUPATIONS = new Set([
    "Q36180", "Q6625963", "Q49757", "Q214917", "Q1930187", "Q1607826",
    "Q482980", "Q4853732", "Q15949613", "Q18844224", "Q1028181",
  ]);
  const occupationIds = (e: WdEntity) =>
    (e.claims?.P106 ?? [])
      .map((c) => c.mainsnak?.datavalue?.value?.id)
      .filter(Boolean) as string[];
  const isWriter = (e: WdEntity) => occupationIds(e).some((id) => WRITER_OCCUPATIONS.has(id));
  const descLooksLiterary = (e: WdEntity) => {
    const d = (e.descriptions?.ru?.value ?? e.descriptions?.en?.value ?? e.descriptions?.kk?.value ?? "").toLowerCase();
    return /писател|writer|novelist|author|поэт|романист|фантаст|журналист|литератор|playwright|poet/.test(d);
  };
  const scoreEntity = (e?: WdEntity): number => {
    if (!e || !isHuman(e)) return -100;
    let s = 0;
    if (e.sitelinks?.ruwiki || e.sitelinks?.enwiki) s += 10;
    if (isWriter(e)) s += 50;
    if (descLooksLiterary(e)) s += 30;
    // Penalize clear non-literary occupations when no writer signal
    const occ = occupationIds(e);
    if (occ.some((id) => ["Q10833314", "Q937857", "Q82955", "Q82955"].includes(id)) && !isWriter(e) && !descLooksLiterary(e)) {
      s -= 40; // tennis player, athlete, politician…
    }
    return s;
  };

  let entity: WdEntity | undefined;
  let bestScore = -Infinity;
  for (const c of candidates) {
    const e = ents.entities?.[c.id];
    const sc = scoreEntity(e);
    if (sc > bestScore) {
      bestScore = sc;
      entity = e;
    }
  }
  const wikiless = !!(entity && !entity.sitelinks?.ruwiki && !entity.sitelinks?.enwiki);
  if (!entity || bestScore < 0) return null;
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
      
    }
  }

  if (wikiless) {
    const d = entity.descriptions;
    const description = d?.ru?.value ?? d?.kk?.value ?? d?.en?.value;
    const label = entity.labels?.ru?.value ?? entity.labels?.kk?.value ?? entity.labels?.en?.value ?? name;
    const file = claim("P18");
    const photo =
      typeof file === "string"
        ? `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=400`
        : undefined;
    if (!description && !born && !died && !birthPlace && !photo) return null;
    const wdUrl = `https://www.wikidata.org/wiki/${entity.id}`;
    return {
      name: label,
      description,
      born,
      died,
      birthPlace,
      photo,
      url: wdUrl,
      wikidataUrl: wdUrl,
      source: "wikidata",
    };
  }

  const lang = entity.sitelinks?.ruwiki ? "ru" : "en";
  const title = (entity.sitelinks?.ruwiki ?? entity.sitelinks?.enwiki)!.title;
  const sum = await getJson<{
    description?: string;
    extract?: string;
    thumbnail?: { source?: string };
    content_urls?: { desktop?: { page?: string } };
    type?: string;
  }>(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, "_"))}`);
  if (sum.type === "disambiguation") return null;

  const wikiTitle = title.replace(/ /g, "_");
  const wikipediaUrl =
    sum.content_urls?.desktop?.page ??
    `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(wikiTitle)}`;
  const wikidataUrl = `https://www.wikidata.org/wiki/${entity.id}`;
  return {
    name: title.replace(/ \(.*\)$/, ""),
    description: sum.description,
    extract: sum.extract,
    born,
    died,
    birthPlace,
    photo:
      typeof claim("P18") === "string"
        ? `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(claim("P18"))}?width=400`
        : sum.thumbnail?.source,
    url: wikipediaUrl,
    wikipediaUrl,
    wikidataUrl,
    source: "wikipedia",
  };
}


async function candidatesFromWikidataFuzzy(name: string): Promise<Candidate[]> {
  const parsed = parseAuthorName(name);
  const found: Candidate[] = [];
  let sawError = false;
  const literaryHints = ["писатель", "writer", "author"];
  const variants = [
    ...searchVariants(name),
    ...searchVariants(name).flatMap((v) => literaryHints.map((h) => `${v} ${h}`)),
  ];
  for (const lang of ["ru", "en", "kk"]) {
    for (const q of variants) {
      try {
        const s = await getJson<{ search?: { id: string; label?: string; match?: { text?: string } }[] }>(
          `${WD}?action=wbsearchentities&format=json&type=item&limit=8&language=${lang}&uselang=${lang}&search=${encodeURIComponent(q)}`,
        );
        for (const c of s.search ?? []) {
          const text = c.match?.text ?? c.label ?? "";
          if (titleMatches(text, parsed) && !found.some((f) => f.id === c.id)) found.push({ id: c.id });
        }
      } catch {
        sawError = true;
      }
      if (found.length >= 5) return found;
    }
  }
  if (!found.length && sawError) throw new Error("wikidata search failed");
  return found;
}


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
        .split(/\n-{3,}/)[0]
        .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
        .replace(/\s+/g, " ")
        .trim();
      if (bio.length > 900) bio = bio.slice(0, 900).replace(/[^.!?]*$/, "").trim() || bio.slice(0, 900);

      const born = a.birth_date ?? doc.birth_date;
      const died = a.death_date ?? doc.death_date;
      if (!bio && !born && !died) continue;
      const photoId = a.photos?.find((x) => x > 0);
      const olUrl = `https://openlibrary.org/authors/${doc.key}`;
      return {
        name: doc.name,
        description: doc.top_work ? `Автор книги «${doc.top_work}»` : undefined,
        extract: bio || undefined,
        born,
        died,
        photo: photoId ? `https://covers.openlibrary.org/a/id/${photoId}-M.jpg` : undefined,
        url: olUrl,
        openLibraryUrl: olUrl,
        source: "openlibrary",
      };
    } catch {
      sawError = true;
    }
  }
  if (sawError) throw new Error("openlibrary failed");
  return null;
}


async function fetchAuthorInfo(name: string): Promise<AuthorInfo | null> {
  let failed = false;
  try {
    const w = await fetchFromWikipedia(name);
    if (w && w.source === "wikipedia") return w;
    if (w) {
      try {
        const o = await fetchFromOpenLibrary(name);
        if (o?.extract) {
          return {
            ...w,
            extract: o.extract,
            source: "openlibrary",
            url: w.url ?? o.url,
            photo: w.photo ?? o.photo,
            openLibraryUrl: o.openLibraryUrl ?? o.url,
            wikipediaUrl: w.wikipediaUrl,
            wikidataUrl: w.wikidataUrl,
          };
        }
      } catch {
        /* ignore openlibrary failure when we already have wiki data */
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

export async function getAuthorInfo(name: string, force = false): Promise<AuthorInfo | null> {
  if (name.trim().length < 2) return null;
  const key = authorKey(name);

  const all = await readJson<Entry[]>(FILE, []);
  const hit = all.find((e) => e.key === key);

  const merge = (info?: AuthorInfo | null, manual = hit?.manual): AuthorInfo | null => manual && Object.values(manual).some(Boolean) ? { ...info, name: info?.name ?? name, ...Object.fromEntries(Object.entries(manual).filter(([,v]) => !!v)), source: "manual" } : info ?? null;
  const fresh = hit && Date.now() - new Date(hit.fetchedAt).getTime() < TTL_MS[hit.status];
  // Re-fetch when algorithm advanced and record lacks photo/extract or the new multi-link fields.
  const missingLinks =
    hit?.status === "ok" &&
    !!hit.info &&
    !hit.info.wikipediaUrl &&
    !hit.info.wikidataUrl &&
    !hit.info.openLibraryUrl &&
    !hit.info.url;
  const stale =
    hit &&
    (hit.v ?? 1) < ALGO_VERSION &&
    (hit.status !== "ok" || !hit.info?.photo || !hit.info?.extract || missingLinks);
  if (!force && fresh && !stale) return merge(hit.info);
  if (!force && hit?.manual?.extract) return merge(hit.info);

  let status: Entry["status"] = "none";
  let info: AuthorInfo | null = null;
  try {
    for (const variant of [...(hit?.aliases ?? []), name]) {
      try { info = await fetchAuthorInfo(variant); } catch { continue; }
      if (info) break;
    }
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
      info: info ?? prev?.info,
      manual: prev?.manual,
      aliases: prev?.aliases,
    };
    await writeJson(FILE, [...cur.filter((e) => e.key !== key), entry]);
  });

  return merge(info ?? hit?.info);
}

export async function listAuthorRecords() { return readJson<Entry[]>(FILE, []); }
export async function saveAuthorRecord(name: string, manual: Partial<AuthorInfo>, aliases: string[]) {
  await withLock("authors", async () => {
    const all = await listAuthorRecords();
    const key = authorKey(name);
    const previous = all.find(e => e.key === key);
    const entry: Entry = { key, status: "none", fetchedAt: "", ...previous, manual: Object.fromEntries(Object.entries({ ...previous?.manual, ...manual }).filter(([,v]) => !!v)), aliases };
    await writeJson(FILE, [...all.filter(e => e.key !== key), entry]);
  });
}
