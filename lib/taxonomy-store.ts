// Серверное хранилище категорий и жанров (data/taxonomy.json).
// Пока файла нет, действуют значения по умолчанию (4 категории и канонический список жанров) —
// поэтому все уже опубликованные книги продолжают показываться как раньше.
//
// Категория хранится в книге ключом (book | textbook | …), поэтому переименование категории меняет только подпись.
// Жанр хранится в книге названием, поэтому переименование/удаление жанра обновляет и книги.
import { readJson, readJsonShared, withLock, writeJson, uid } from "./db";
import {
  CANONICAL_GENRES,
  DEFAULT_CATEGORIES,
  genreKey,
  normalizeGenreName,
  parseCategory,
  setCategoryRegistry,
  setGenreRegistry,
  type CategoryDef,
} from "./categories";

export type GenreDef = { id: string; name: string };
export type Taxonomy = { categories: CategoryDef[]; genres: GenreDef[] };
export type TaxonomyUsage = { categories: Record<string, number>; genres: Record<string, number> };

const FILE = "taxonomy.json";
const USER_FILE = "user-books.json";
const CATALOG_FILE = "catalog-books.json";

export const CATEGORY_LABEL_MAX = 40;
export const GENRE_MAX = 60;

type BookLike = { id: number | string; category?: string; genre?: string; genres?: string[]; deleted?: boolean; [k: string]: unknown };

const seedGenres = (): GenreDef[] => CANONICAL_GENRES.map((name, i) => ({ id: `g${i + 1}`, name }));

function sanitize(raw: Partial<Taxonomy> | null | undefined): Taxonomy {
  const cats = Array.isArray(raw?.categories)
    ? raw!.categories.filter((c) => c && typeof c.key === "string" && typeof c.label === "string")
    : [];
  const genres = Array.isArray(raw?.genres)
    ? raw!.genres.filter((g) => g && typeof g.id === "string" && typeof g.name === "string")
    : [];
  return {
    categories: raw?.categories ? cats.map((c) => ({ key: c.key, label: c.label, singular: c.singular || c.label })) : DEFAULT_CATEGORIES,
    genres: raw?.genres ? genres : seedGenres(),
  };
}

/** Читает категории и жанры и обновляет реестры в памяти (подписи, синонимы жанров). */
export async function getTaxonomy(): Promise<Taxonomy> {
  const raw = await readJsonShared<Partial<Taxonomy> | null>(FILE, null);
  const t = sanitize(raw);
  setCategoryRegistry(t.categories);
  setGenreRegistry(t.genres.map((g) => g.name));
  return t;
}

async function save(t: Taxonomy) {
  await writeJson(FILE, t);
  setCategoryRegistry(t.categories);
  setGenreRegistry(t.genres.map((g) => g.name));
}

const collator = new Intl.Collator("ru");

// ---------------- вспомогательное ----------------

const cleanLabel = (v: unknown, max: number) =>
  String(v ?? "").trim().replace(/\s+/g, " ").slice(0, max);

const capitalize = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

const TRANSLIT: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m",
  н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "c", ч: "ch", ш: "sh", щ: "sch",
  ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya", ә: "a", і: "i", ң: "n", ғ: "g", ү: "u", ұ: "u", қ: "k", ө: "o", һ: "h",
};

function slugify(label: string): string {
  const s = label
    .toLowerCase()
    .split("")
    .map((ch) => TRANSLIT[ch] ?? ch)
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
  return s || "cat";
}

function uniqueKey(label: string, taken: Set<string>): string {
  const base = slugify(label);
  if (!taken.has(base)) return base;
  for (let i = 2; i < 1000; i++) if (!taken.has(`${base}-${i}`)) return `${base}-${i}`;
  return `${base}-${uid().slice(0, 6)}`;
}

/** Книги из обоих файлов (пользовательские перекрывают каталожные по id), без удалённых — для подсчёта использования. */
async function allBooksForCount(): Promise<BookLike[]> {
  const [user, catalog] = await Promise.all([
    readJsonShared<BookLike[]>(USER_FILE, []),
    readJsonShared<BookLike[]>(CATALOG_FILE, []),
  ]);
  const byId = new Map<string, BookLike>();
  for (const b of catalog) byId.set(String(b.id), b);
  for (const b of user) byId.set(String(b.id), b);
  return Array.from(byId.values()).filter((b) => !b.deleted);
}

const bookGenres = (b: BookLike): string[] => {
  const raw = Array.isArray(b.genres) && b.genres.length ? b.genres : b.genre ? [b.genre] : [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const g of raw) {
    const n = normalizeGenreName(g);
    if (!n || seen.has(genreKey(n))) continue;
    seen.add(genreKey(n));
    out.push(n);
  }
  return out;
};

/** Сколько книг в каждой категории и в каждом жанре. */
export async function getUsage(): Promise<TaxonomyUsage> {
  await getTaxonomy();
  const books = await allBooksForCount();
  const categories: Record<string, number> = {};
  const genres: Record<string, number> = {};
  for (const b of books) {
    const c = parseCategory(b.category);
    if (c) categories[c] = (categories[c] ?? 0) + 1;
    for (const g of bookGenres(b)) genres[genreKey(g)] = (genres[genreKey(g)] ?? 0) + 1;
  }
  return { categories, genres };
}

/** Применяет изменение ко всем книгам в обоих файлах; пишет файл только если что-то поменялось. Возвращает число изменённых книг. */
async function rewriteBooks(fn: (b: BookLike) => BookLike | null): Promise<number> {
  let total = 0;
  for (const file of [USER_FILE, CATALOG_FILE]) {
    await withLock(file === USER_FILE ? "user-books" : "catalog-books", async () => {
      const list = await readJson<BookLike[]>(file, []);
      let changed = 0;
      const next = list.map((b) => {
        const r = fn(b);
        if (r) {
          changed++;
          return r;
        }
        return b;
      });
      if (changed) {
        await writeJson(file, next);
        total += changed;
      }
    });
  }
  return total;
}

export class TaxonomyError extends Error {}
function fail(m: string): never {
  throw new TaxonomyError(m);
}

// ---------------- категории ----------------

export function addCategory(labelRaw: unknown, singularRaw?: unknown): Promise<Taxonomy> {
  return withLock("taxonomy", async () => {
    const t = await getTaxonomy();
    const label = capitalize(cleanLabel(labelRaw, CATEGORY_LABEL_MAX));
    const singular = capitalize(cleanLabel(singularRaw, CATEGORY_LABEL_MAX)) || label;
    if (label.length < 2) fail("Название категории — не короче 2 символов");
    if (t.categories.some((c) => c.label.toLowerCase() === label.toLowerCase() || c.singular.toLowerCase() === singular.toLowerCase()))
      fail("Такая категория уже есть");
    const key = uniqueKey(label, new Set(t.categories.map((c) => c.key)));
    const next = { ...t, categories: [...t.categories, { key, label, singular }] };
    await save(next);
    return next;
  });
}

export function updateCategory(key: string, labelRaw: unknown, singularRaw?: unknown): Promise<Taxonomy> {
  return withLock("taxonomy", async () => {
    const t = await getTaxonomy();
    const cur = t.categories.find((c) => c.key === key);
    if (!cur) fail("Категория не найдена");
    const label = capitalize(cleanLabel(labelRaw, CATEGORY_LABEL_MAX));
    const singular = capitalize(cleanLabel(singularRaw, CATEGORY_LABEL_MAX)) || label;
    if (label.length < 2) fail("Название категории — не короче 2 символов");
    if (
      t.categories.some(
        (c) => c.key !== key && (c.label.toLowerCase() === label.toLowerCase() || c.singular.toLowerCase() === singular.toLowerCase()),
      )
    )
      fail("Такая категория уже есть");
    const next = { ...t, categories: t.categories.map((c) => (c.key === key ? { key, label, singular } : c)) };
    await save(next);
    return next;
  });
}

/** Удаляет категорию. Если в ней есть книги, их нужно перенести в другую (moveTo): книги не пропадают. */
export function deleteCategory(key: string, moveTo?: string): Promise<{ taxonomy: Taxonomy; moved: number }> {
  return withLock("taxonomy", async () => {
    const t = await getTaxonomy();
    if (!t.categories.some((c) => c.key === key)) fail("Категория не найдена");
    if (t.categories.length <= 1) fail("Нельзя удалить последнюю категорию");
    const usage = (await getUsage()).categories[key] ?? 0;
    let moved = 0;
    if (usage > 0) {
      if (!moveTo || moveTo === key || !t.categories.some((c) => c.key === moveTo))
        fail(`В категории ${usage} книг — выберите, куда их перенести`);
      moved = await rewriteBooks((b) => (parseCategory(b.category) === key ? { ...b, category: moveTo } : null));
    }
    const next = { ...t, categories: t.categories.filter((c) => c.key !== key) };
    await save(next);
    return { taxonomy: next, moved };
  });
}

// ---------------- жанры ----------------

/** Проверяет название жанра: не пустое и не совпадает (с учётом синонимов) с другим жанром. */
function checkGenreName(t: Taxonomy, raw: unknown, selfId?: string): string {
  const name = capitalize(cleanLabel(raw, GENRE_MAX));
  if (name.length < 2) fail("Название жанра — не короче 2 символов");
  const k = genreKey(name);
  const viaAlias = genreKey(normalizeGenreName(name)); // «ужасы» совпадёт с «Хоррор»
  for (const g of t.genres) {
    if (g.id === selfId) continue;
    const gk = genreKey(g.name);
    if (gk === k || gk === viaAlias) fail(`Жанр «${g.name}» уже есть`);
  }
  return name;
}

export function addGenre(raw: unknown): Promise<Taxonomy> {
  return withLock("taxonomy", async () => {
    const t = await getTaxonomy();
    const name = checkGenreName(t, raw);
    const next = { ...t, genres: [...t.genres, { id: uid(), name }].sort((a, b) => collator.compare(a.name, b.name)) };
    await save(next);
    return next;
  });
}

/** Меняет в книгах жанр from → to (to = null: убрать жанр). Сравнение — по текущему реестру, до его обновления. */
function rewriteGenreInBooks(from: string, to: string | null) {
  const fk = genreKey(from);
  return rewriteBooks((b) => {
    const list = bookGenres(b);
    if (!list.some((g) => genreKey(g) === fk)) return null;
    const out: string[] = [];
    const seen = new Set<string>();
    for (const g of list) {
      const v = genreKey(g) === fk ? to : g;
      if (!v || seen.has(genreKey(v))) continue;
      seen.add(genreKey(v));
      out.push(v);
    }
    return { ...b, genres: out, genre: out[0] ?? "—" };
  });
}

export function updateGenre(id: string, raw: unknown): Promise<{ taxonomy: Taxonomy; updated: number }> {
  return withLock("taxonomy", async () => {
    const t = await getTaxonomy();
    const cur = t.genres.find((g) => g.id === id);
    if (!cur) fail("Жанр не найден");
    const name = checkGenreName(t, raw, id);
    let updated = 0;
    if (name !== cur!.name) updated = await rewriteGenreInBooks(cur!.name, name);
    const next = {
      ...t,
      genres: t.genres.map((g) => (g.id === id ? { id, name } : g)).sort((a, b) => collator.compare(a.name, b.name)),
    };
    await save(next);
    return { taxonomy: next, updated };
  });
}

/** Удаляет жанр из списка и снимает его с книг (сами книги остаются). */
export function deleteGenre(id: string): Promise<{ taxonomy: Taxonomy; updated: number }> {
  return withLock("taxonomy", async () => {
    const t = await getTaxonomy();
    const cur = t.genres.find((g) => g.id === id);
    if (!cur) fail("Жанр не найден");
    const updated = await rewriteGenreInBooks(cur!.name, null);
    const next = { ...t, genres: t.genres.filter((g) => g.id !== id) };
    await save(next);
    return { taxonomy: next, updated };
  });
}
