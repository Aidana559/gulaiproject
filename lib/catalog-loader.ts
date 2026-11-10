import type { Book, Category } from "@/data/books";
import { readJson, withLock, writeJson } from "./db";
import { CATEGORY_TARGET, ID_POOLS, catalogPlan, type Slot } from "./catalog-seed";

/**
 * Автозагрузка каталога из Google Books API.
 *
 * Как работает:
 *  1. Читает data/catalog-books.json (там каталог лежит постоянно, переживает перезапуск).
 *  2. Если в какой-то категории меньше CATEGORY_TARGET книг — добирает недостающие
 *     из Google Books по плану lib/catalog-seed.ts и дописывает в файл.
 *  3. Если файл уже заполнен, в сеть не ходит.
 *
 * Все поля книги (название, авторы, обложка, описание, ISBN, год, страницы)
 * берутся из ответа Google Books. Ничего не выдумывается: книга без названия,
 * автора, ISBN или года просто пропускается.
 */

export const CATALOG_FILE = "catalog-books.json";
const USER_FILE = "user-books.json";
const FIRST_ID = 2001; // запасной диапазон id, если id категории (ID_POOLS) закончились
const SCHEMA = 2; // версия формата каталога (id по ID_POOLS, только русские книги)
const BOOKINGS_FILE = "bookings.json";
const OWNER = "Библиотека";
const API = process.env.GOOGLE_BOOKS_API_URL ?? "https://www.googleapis.com/books/v1/volumes";
const COOLDOWN_MS = 5 * 60 * 1000;
const PAUSE_MS = 250;

export type CatalogBook = Book & {
  lang?: string;
  schema?: number;
  ownerId?: string;
  coverUrl: string | null;
  views: number;
  createdAt: string;
  hidden: boolean;
  deleted: boolean;
};

type Volume = {
  id: string;
  volumeInfo?: {
    title?: string;
    subtitle?: string;
    language?: string;
    authors?: string[];
    publishedDate?: string;
    description?: string;
    pageCount?: number;
    industryIdentifiers?: { type: string; identifier: string }[];
    imageLinks?: { thumbnail?: string; smallThumbnail?: string };
  };
};

type Candidate = {
  googleId: string;
  title: string;
  authors: string[];
  year: number;
  pages: number;
  description: string;
  isbn: string;
  cover: string | null;
};

const GRADIENTS = [
  "from-indigo-500 to-purple-600",
  "from-teal-500 to-emerald-600",
  "from-rose-500 to-orange-500",
  "from-sky-500 to-blue-700",
  "from-amber-400 to-orange-600",
  "from-fuchsia-500 to-pink-600",
  "from-cyan-500 to-teal-700",
  "from-violet-500 to-indigo-700",
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

function cleanDescription(raw: string): string {
  let t = raw
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/p>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
  if (t.length > 1500) {
    const cut = t.slice(0, 1500);
    const end = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
    t = end > 600 ? cut.slice(0, end + 1) : cut.trimEnd() + "…";
  }
  return t;
}

function toCandidate(v: Volume): Candidate | null {
  const i = v.volumeInfo;
  if (!i?.title) return null;
  if (i.language !== "ru") return null; // только книги на русском языке

  const ids = i.industryIdentifiers ?? [];
  const isbn =
    ids.find((x) => x.type === "ISBN_13")?.identifier ??
    ids.find((x) => x.type === "ISBN_10")?.identifier ??
    "";
  const year = Number((i.publishedDate ?? "").slice(0, 4)) || 0;
  const authors = (i.authors ?? []).map((a) => a.trim()).filter(Boolean);
  if (!isbn || !year || authors.length === 0) return null;

  const rawCover = i.imageLinks?.thumbnail ?? i.imageLinks?.smallThumbnail ?? "";
  const cover = rawCover
    ? rawCover.replace(/^http:\/\//, "https://").replace(/&edge=curl/g, "")
    : null;

  if (!cover) return null; // только книги с обложкой из Google Books

  const title = i.title.trim();
  const sub = (i.subtitle ?? "").trim();
  const full = sub && !norm(title).includes(norm(sub)) ? `${title}: ${sub}` : title;

  return {
    googleId: v.id,
    title: full,
    authors,
    year,
    pages: i.pageCount && i.pageCount > 0 ? i.pageCount : 0,
    description: cleanDescription(i.description ?? ""),
    isbn,
    cover,
  };
}

async function search(q: string, lang: string): Promise<Volume[]> {
  const key = process.env.GOOGLE_BOOKS_API_KEY;

  const build = (withKey: boolean) => {
    const url = new URL(API);
    url.searchParams.set("q", q);
    url.searchParams.set("maxResults", "20");
    url.searchParams.set("printType", "books");
    url.searchParams.set("orderBy", "relevance");
    if (lang) url.searchParams.set("langRestrict", lang);
    if (withKey && key) url.searchParams.set("key", key);
    return url;
  };

  let useKey = !!key;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(build(useKey), {
        cache: "no-store",
        signal: AbortSignal.timeout(15000),
      });
      if (res.ok) {
        const json = (await res.json()) as { items?: Volume[] };
        return json.items ?? [];
      }
      // ключ с ограничениями (referrer/IP) может быть отклонён — пробуем без ключа
      if ((res.status === 400 || res.status === 403) && useKey) {
        useKey = false;
        continue;
      }
      if (res.status === 429 || res.status >= 500) {
        await sleep(1500 * 2 ** attempt);
        continue;
      }
      return [];
    } catch {
      await sleep(1000 * (attempt + 1));
    }
  }
  return [];
}

function matches(c: Candidate, s: Slot): boolean {
  const hay = norm(c.title);
  if (!s.titleAny.some((t) => hay.includes(norm(t)))) return false;
  if (s.titleNone?.some((t) => hay.includes(norm(t)))) return false;
  if (s.titleRe && !new RegExp(s.titleRe, "i").test(c.title.toLowerCase())) return false;
  if (s.authorAny) {
    const a = norm(c.authors.join(" "));
    if (!s.authorAny.some((t) => a.includes(norm(t)))) return false;
  }
  return true;
}

const score = (c: Candidate) =>
  (c.cover ? 3 : 0) +
  (c.description.length >= 40 ? 3 : 0) +
  (c.pages ? 1 : 0) +
  (c.isbn.length === 13 ? 1 : 0);

const keyOf = (title: string, author: string) => `${norm(title)}|${norm(author)}`;
const isbnKey = (isbn: string) => isbn.replace(/[^0-9Xx]/g, "").toUpperCase();

type Seen = { ids: Set<string>; isbns: Set<string>; titles: Set<string> };

function isSeen(c: Candidate, seen: Seen) {
  return (
    seen.ids.has(c.googleId) ||
    seen.isbns.has(isbnKey(c.isbn)) ||
    seen.titles.has(keyOf(c.title, c.authors[0]))
  );
}
function markSeen(c: Candidate, seen: Seen) {
  seen.ids.add(c.googleId);
  seen.isbns.add(isbnKey(c.isbn));
  seen.titles.add(keyOf(c.title, c.authors[0]));
}

async function pickForSlot(s: Slot, seen: Seen): Promise<Candidate[]> {
  // всегда только русские издания
  const attempts: { q: string; lang: string }[] = [{ q: s.q, lang: "ru" }];

  const take = s.take ?? 1;
  const picked: Candidate[] = [];

  for (const a of attempts) {
    const vols = await search(a.q, a.lang);
    await sleep(PAUSE_MS);

    const found = vols
      .map(toCandidate)
      .filter((c): c is Candidate => !!c && matches(c, s))
      .map((c, idx) => ({ c, idx }))
      .sort((x, y) => score(y.c) - score(x.c) || x.idx - y.idx)
      .map((x) => x.c);

    for (const c of found) {
      if (picked.length >= take) break;
      if (isSeen(c, seen)) continue;
      markSeen(c, seen);
      picked.push(c);
    }
    if (picked.length >= take) break;
  }
  return picked;
}

async function loadCategory(
  cat: Category,
  need: number,
  seen: Seen,
): Promise<{ c: Candidate; genres: string[] }[]> {
  const result: { c: Candidate; genres: string[] }[] = [];
  for (const slot of catalogPlan[cat]) {
    if (result.length >= need) break;
    const picked = await pickForSlot(slot, seen);
    for (const c of picked) {
      if (result.length >= need) break;
      result.push({ c, genres: slot.genres });
    }
  }
  return result;
}

async function appendBooks(cat: Category, items: { c: Candidate; genres: string[] }[]) {
  if (items.length === 0) return;
  await withLock("catalog-file", async () => {
    const list = await readJson<CatalogBook[]>(CATALOG_FILE, []);
    const used = new Set(list.map((b) => Number(b.id)));
    let next = Math.max(FIRST_ID - 1, ...list.map((b) => Number(b.id) || 0)) + 1;
    const now = new Date().toISOString();
    for (const { c, genres } of items) {
      const free = ID_POOLS[cat].find((n) => !used.has(n));
      const id = free ?? next++;
      used.add(id);
      list.push({
        id,
        title: c.title,
        author: c.authors.slice(0, 3).join(", "),
        category: cat,
        genre: genres[0],
        genres,
        status: "available",
        owner: OWNER,
        city: "—",
        year: c.year,
        pages: c.pages,
        description: c.description,
        isbn: c.isbn,
        googleId: c.googleId,
        lang: "ru",
        schema: SCHEMA,
        coverUrl: c.cover,
        gradient: GRADIENTS[id % GRADIENTS.length],
        views: 0,
        createdAt: now,
        hidden: false,
        deleted: false,
      });
    }
    await writeJson(CATALOG_FILE, list);
  });
}

/** Убираем книги прошлой версии каталога, загруженные не на русском (без пометки lang: "ru") */
async function purgeNonRussian() {
  // старые копии «ручных» книг (id 1–42 без владельца) не должны перекрывать книги каталога
  await withLock("catalog-file", async () => {
    const users = await readJson<{ id: number | string; ownerId?: string }[]>(USER_FILE, []);
    const kept = users.filter((u) => !(Number(u.id) >= 1 && Number(u.id) <= 42 && !u.ownerId));
    if (kept.length !== users.length) await writeJson(USER_FILE, kept);
  });
  await withLock("catalog-file", async () => {
    const list = await readJson<CatalogBook[]>(CATALOG_FILE, []);
    const bad = list.filter((b) => b.lang !== "ru" || b.schema !== SCHEMA || !b.coverUrl);
    if (bad.length === 0) return;
    await writeJson(CATALOG_FILE, list.filter((b) => !bad.includes(b)));
    // копии этих книг в user-books.json (счётчик просмотров и т.п.) тоже убираем
    const ids = new Set(bad.map((b) => String(b.id)));
    const users = await readJson<{ id: number | string; googleId?: string; ownerId?: string }[]>(USER_FILE, []);
    const kept = users.filter((u) => !(ids.has(String(u.id)) && u.googleId && !u.ownerId));
    if (kept.length !== users.length) await writeJson(USER_FILE, kept);
  });
}

/** Бронировать могут только обычные пользователи: брони админов и модераторов удаляем */
async function purgeStaffBookings() {
  const users = await readJson<{ id: string; role?: string }[]>("users.json", []);
  const staff = new Set(users.filter((u) => u.role === "admin" || u.role === "moderator").map((u) => String(u.id)));
  if (staff.size === 0) return;
  await withLock("bookings", async () => {
    const list = await readJson<{ userId?: string }[]>(BOOKINGS_FILE, []);
    const kept = list.filter((b) => !staff.has(String(b.userId)));
    if (kept.length !== list.length) await writeJson(BOOKINGS_FILE, kept);
  });
}

async function run() {
  await purgeStaffBookings();
  await purgeNonRussian();
  const existing = await readJson<CatalogBook[]>(CATALOG_FILE, []);
  const userBooks = await readJson<
    { id: number | string; title?: string; author?: string; isbn?: string; googleId?: string }[]
  >(USER_FILE, []);

  const seen: Seen = { ids: new Set(), isbns: new Set(), titles: new Set() };
  for (const b of [...existing, ...userBooks]) {
    if (b.googleId) seen.ids.add(b.googleId);
    if (b.isbn) seen.isbns.add(isbnKey(b.isbn));
    if (b.title && b.author) seen.titles.add(keyOf(b.title, b.author));
  }

  const cats = Object.keys(catalogPlan) as Category[];
  const missing = cats
    .map((cat) => ({ cat, need: CATEGORY_TARGET[cat] - existing.filter((b) => b.category === cat).length }))
    .filter((x) => x.need > 0);
  if (missing.length === 0) {
    await syncBookingLabels();
    return;
  }

  await Promise.all(
    missing.map(async ({ cat, need }) => {
      const items = await loadCategory(cat, need, seen);
      await appendBooks(cat, items);
    }),
  );
  await syncBookingLabels();
}

/**
 * Брони ссылаются на книги по id. Названия/авторы в них — подписи для показа;
 * приводим их к книгам каталога с тем же id. Статусы, даты и пользователи не меняются.
 */
async function syncBookingLabels() {
  const catalog = await readJson<CatalogBook[]>(CATALOG_FILE, []);
  if (catalog.length === 0) return;
  const byId = new Map(catalog.map((b) => [Number(b.id), b]));
  await withLock("bookings", async () => {
    const list = await readJson<{ bookId?: number; bookTitle?: string; bookAuthor?: string }[]>(BOOKINGS_FILE, []);
    let changed = false;
    for (const b of list) {
      const book = byId.get(Number(b.bookId));
      if (!book) continue;
      if (b.bookTitle !== book.title || b.bookAuthor !== book.author) {
        b.bookTitle = book.title;
        b.bookAuthor = book.author;
        changed = true;
      }
    }
    if (changed) await writeJson(BOOKINGS_FILE, list);
  });
}

type G = { __catalogJob?: Promise<void>; __catalogLast?: number };
const g = globalThis as unknown as G;

/**
 * Запускает загрузку, если каталог неполный. Безопасно вызывать сколько угодно раз:
 * параллельные вызовы объединяются, а после неудачи повтор не чаще раза в 5 минут.
 */
export function ensureCatalog(): Promise<void> {
  if (g.__catalogJob) return g.__catalogJob;
  if (g.__catalogLast && Date.now() - g.__catalogLast < COOLDOWN_MS) return Promise.resolve();

  const job = run()
    .catch((e) => {
      console.error("[catalog] не удалось загрузить книги из Google Books:", e);
    })
    .finally(() => {
      g.__catalogLast = Date.now();
      g.__catalogJob = undefined;
    });
  g.__catalogJob = job;
  return job;
}

/** Принудительная повторная проверка (без паузы между попытками). */
export function ensureCatalogNow(): Promise<void> {
  g.__catalogLast = undefined;
  return ensureCatalog();
}
